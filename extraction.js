const dotenv = require("dotenv")
const { OpenAI } = require("openai")
dotenv.config()
const openai = new OpenAI({ apikey: process.env.OPENAI_API_KEY })
async function extractQuotationDetails(email) {
    const systemPrompt = `
You are an information extraction system.

Extract quotation-related information from the email.

Return JSON:

{
  "company_name": "",
  "contact_person": "",
  "products": [],
  "quantity": "",
  "budget": "",
  "deadline": "",
  "additional_notes": ""
}

If a field is not found, return null.
Only return valid JSON.
`;

    const userPrompt = `
Subject: ${email.subject}
From: ${email.from}

Body:
${email.body}
`;
    try {
        const response = await openai.responses.create({
            model: "gpt-4o-mini",

            input: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0


        })
        const info = JSON.parse(response.output_text.replace(/```json|```/g, '').trim())
        console.log("Info:", info)
        return info
    } catch (err) {
        return err
    }

}

module.exports = { extractQuotationDetails }