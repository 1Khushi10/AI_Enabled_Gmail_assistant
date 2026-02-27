const dotenv = require("dotenv")
const OpenAI = require("openai");
dotenv.config()
const openAi = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function classifyEmail(email) {
    const systemPrompt = `
You are an email classification system.

Classify the email into one of these categories:

1. quotation_request
   - standard quotation requests from customers
   - pricing inquiries, budget estimates, or requests for proposals for routine orders

2. non_quotation
   - spam
   - newsletters
   - marketing promotions
   - personal emails
   - unrelated business communication

3. important
   - large enterprise deals or high-value contracts (budget > $100,000)
   - custom or complex requirements
   - tight deadlines or high priority requests
   - negative sentiment or urgent escalation
   - missing critical information that needs manual review

Return output in JSON format:
{
  "category": "quotation_request" | "non_quotation" | "important",
  "reason": "short explanation"
}

Only return valid JSON. Carefully choose the category that best reflects urgency, scale, or complexity.
`;

    const userPrompt = `
Subject: ${email.subject}
From: ${email.from}

Body:
${email.body}
`;

    try {
        const response = await openAi.responses.create({
            model: "gpt-4o-mini",
            input: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0
        });


        const output = response.output[0].content[0].text.replace(/```json|```/g, '').trim();


        return JSON.parse(output);

    } catch (err) {
        console.error("Classification error:", err);
        return { category: null, reason: err.message };
    }
}
module.exports = { classifyEmail }