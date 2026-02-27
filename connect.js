const { classifyEmail } = require("./classify.js")
const { extractQuotationDetails } = require("./extraction.js")
const { callLLM } = require("./llmClient.js")

async function processEmail(email) {

    const classification = await classifyEmail(email);
    console.log(classification)
    if (classification.category == "quotation_request") {
        const info = await extractQuotationDetails(email)
        console.log("INFORMATION:", info)
        const systemPrompt = `
You are a professional email assistant for a sales/quotation team.

Your job is to:
- Read the provided quotation details from a customer email.
- Compose a polite, concise, and professional reply.
- Address the customer's request (pricing, budget, timeline, product information) based on the extracted details.
- If any required information is missing, politely mention that you will follow up or request clarification.
- Maintain a friendly but professional tone.
- Generate the reply email in JSON format only, with the following fields:
Only ask for missing information if all required fields (Company, Contact, Product, Quantity) are empty.
- Otherwise, compose a reply using the provided details.
- Output must be valid JSON with subject and body fields only.
{
  "subject": "Subject of the email",
  "body": "Full email body including greeting and signature",
  "type":"reply"
}
- - Kepp name:A, company:ABC and contact:a@gmail.com
- Do not include any internal notes or extra text; the output should be ready to send as an email.
`;
        const userPrompt = `
Here are the details extracted from the customer's email:

Company Name: ${info.company_name || "MISSING"}
Contact Person: ${info.contact_person || "MISSING"}
Products: ${info.products?.join(", ") || "MISSING"}
Quantity: ${info.quantity || "MISSING"}
Budget: ${info.budget || "MISSING"}
Deadline: ${info.deadline || "MISSING"}
Additional Notes: ${info.additional_notes || "MISSING"}

Compose a professional reply:
- Use all provided details that are not "MISSING".
- Only politely ask for missing details if the field is marked as "MISSING".
- Address the customer by their name if provided.
- Include greeting, body, and signature.
- Output only valid JSON in this format:
{
  "subject": "Subject of the email",
  "body": "Full email body"
}
`;
        console.log(info)
        const llmOutput = await callLLM(systemPrompt, userPrompt)
        const result = JSON.parse(llmOutput)
        console.log(result)
        return result

    } else if (classification.category == "important") {
        console.log("important block")
        return { type: "important" }
    }
    else {
        console.log(classification)
    }
}

module.exports = { processEmail }