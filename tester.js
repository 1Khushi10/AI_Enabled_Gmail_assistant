const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const readlineSync = require("readline-sync");
const { htmlToText } = require("html-to-text");
const { processEmail } = require("./ai_logic/connect.js")
const { PubSub } = require("@google-cloud/pubsub")
const SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify"
];

const pubsub = new PubSub()
const TOKEN_PATH = path.join(__dirname, "token.json");
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const subscription = pubsub.subscription("gmail-sub")
async function authorize() {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_id, client_secret, redirect_uris } = credentials.web;

    const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,

        redirect_uris[0]
    );

    if (fs.existsSync(TOKEN_PATH)) {
        oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
        return oAuth2Client;
    } else {
        return await getAccessToken(oAuth2Client);
    }
}

async function getAccessToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
    });

    console.log("Authorize this app by visiting this URL:", authUrl);
    const code = readlineSync.question("Enter the code from that page here: ");

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log("Token stored to", TOKEN_PATH);
    return oAuth2Client;
}


async function startWatch(auth) {
    const gmail = new google.gmail({ version: "v1", auth })
    const res = await gmail.users.watch({
        userId: "me",
        requestBody: {
            topicName: 'projects/river-blade-488409-k2/topics/gmail-notifications',
            labelIds: ['INBOX', 'UNREAD'],
        },
    })
    console.log("Watch response: ", res.data)

    return res.data
}
// Example: list Gmail inbox messages


async function getMessageData(auth, msgid) {
    const gmail = google.gmail({ version: "v1", auth })
    const res = await gmail.users.messages.get({ userId: "me", id: msgid })
    console.log(res.data)
    return res.data
}


function extractHeader(headers, name) {
    return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || null;
}

function decodeBase64(data) {
    if (!data) return null;
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
        .toString('utf-8');
}

function extractParts(payload, result = { text: null, html: null, attachments: [] }) {
    if (!payload) return result;

    // If no multipart
    if (!payload.parts) {
        if (payload.mimeType === "text/plain") {
            result.text = decodeBase64(payload.body?.data);
        }
        if (payload.mimeType === "text/html") {
            result.html = decodeBase64(payload.body?.data);
        }
        return result;
    }

    // Multipart
    for (const part of payload.parts) {
        if (part.mimeType === "text/plain") {
            result.text = decodeBase64(part.body?.data);
        } else if (part.mimeType === "text/html") {
            result.html = decodeBase64(part.body?.data);
        } else if (part.filename) {
            result.attachments.push({
                filename: part.filename,
                mimeType: part.mimeType,
                attachmentId: part.body?.attachmentId
            });
        }

        // Recursively check nested parts
        if (part.parts) {
            extractParts(part, result);
        }
    }

    return result;
}

function structureMessage(message) {
    const headers = message.payload.headers;

    const structured = {
        id: message.id,
        threadId: message.threadId,
        subject: extractHeader(headers, "Subject"),
        from: extractHeader(headers, "From"),
        to: extractHeader(headers, "To"),
        date: extractHeader(headers, "Date"),
        snippet: message.snippet,
        text: null,
        html: null,
        attachments: []
    };

    const parts = extractParts(message.payload);

    structured.text = parts.text;
    structured.html = parts.html;

    structured.attachments = parts.attachments;

    return structured;
}
function makeEmail(email, { to, from, subject, body }) {
    const message =
        `From: ${from}\r\n` +
        `To: ${to}\r\n` +
        `Subject: Re: ${subject}\r\n` +
        `In-Reply-To:<${email.id}>\r\n` +
        `References:<${email.id}>\r\n` +
        `Content-Type: text/plain; charset="UTF-8"\r\n` +
        `\r\n` +
        `${body}`;


    const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    return encodedMessage;
}

async function sendEmail(email, auth, { to, from, body, subject }) {
    const gmail = google.gmail({ version: "v1", auth })
    const raw = makeEmail(email, { to, from, body, subject })
    const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
            raw,
            threadId: email.threadId
        },


    })
    console.log(res.data)

}
async function flagEmail(auth, email) {
    const gmail = new google.gmail({ version: "v1", auth })
    await gmail.users.messages.modify({
        userId: "me",
        id: email.id,
        requestBody: {
            addLabelIds: ["STARRED"],
            removeLabelIDs: []
        }
    })
    console.log(`${email.id} is flagged as starred.`)
}
async function main() {
    const auth = await authorize();

    const watchData = await startWatch(auth);
    fs.writeFileSync("lastHistoryId.json", JSON.stringify({ historyId: watchData.historyId }));

    console.log("Waiting for Gmail notifications...");

    subscription.on("message", async (message) => {
        const data = JSON.parse(Buffer.from(message.data, "base64").toString());
        console.log("Notification received:", data);


        const gmail = google.gmail({ version: "v1", auth });

        const lastHistory = JSON.parse(fs.readFileSync("lastHistoryId.json")).historyId;


        const history = await gmail.users.history.list({
            userId: "me",
            startHistoryId: lastHistory,
            historyTypes: ["messageAdded"]
        });

        if (history.data.history) {
            for (const h of history.data.history) {
                if (h.messagesAdded) {
                    for (const msg of h.messagesAdded) {

                        const fullMsg = await getMessageData(auth, msg.message.id);
                        if (!fullMsg.labelIds.includes("INBOX")) continue;
                        if (fullMsg.labelIds.includes("SENT")) continue;
                        const email = structureMessage(fullMsg);
                        if (email.from?.includes("khushi.chauhan@winklix.com")) continue;

                        email.body = email.text || htmlToText(email.html || "", { wordwrap: 0 });

                        const result = await processEmail(email);

                        if (result) {
                            if (result.type == "important") {
                                flagEmail(auth, email)
                            }
                            else if (result.type == "reply") {
                                await sendEmail(email, auth, {
                                    to: email.from,
                                    from: "khushi.chauhan@winklix.com",
                                    subject: result.subject,
                                    body: result.body
                                });
                            } else {
                                console.log("NON-QUOTATION MAIL")
                            }
                        }
                    }
                }
            }
        }


        fs.writeFileSync("lastHistoryId.json", JSON.stringify({ historyId: history.data.historyId }));

        message.ack();
    });
}

main().catch(console.error);