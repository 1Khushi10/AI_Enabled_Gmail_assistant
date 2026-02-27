const dotenv = require("dotenv")
const { OpenAI } = require("openai")

dotenv.config()
const openAi = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function callLLM(systemPrompt, userPrompt) {
    const response = await openAi.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ]
    })
    return (response.choices[0].message.content);

}


module.exports = { callLLM }