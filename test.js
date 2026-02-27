// test.js


const { classifyEmail } = require("./classify.js");

async function main() {
    // Example email to test
    const email = {
        subject: "Request for quotation",
        from: "john.doe@abccompany.com",
        body: `
Dear Sales Team,

We are looking for a custom enterprise software solution to handle our global operations. This will involve integrating multiple ERP and CRM systems across our 12 international offices.

The project has a tight deadline of 3 months, and the estimated budget is around USD 2,000,000. We require a detailed proposal outlining your capability to meet these requirements.

Please treat this request as high priority and escalate internally if needed.

Best regards,
Michael Smith
VP of IT
BigCorp International
`
    };

    try {
        const result = await classifyEmail(email);
        console.log(result)
    } catch (err) {
        console.error("Error extracting quotation details:", err);
    }
}

main();