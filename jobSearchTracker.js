require('dotenv').config();

const inquirer = require('inquirer');
const OpenAIAPI = require('openai');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

const openai = new OpenAIAPI({
    key: process.env.OPENAI_API_KEY,
});

async function extractJobInfoFromIndeed(htmlContent) {
    const prompt = `Extract the following job information from this Indeed job listing:\n\n${htmlContent}\n\nJob Title: \nCompany: \nLocation: \nDate Posted: \nStatus: `;
    const maxTokens = 100;

    const response = await openai.createCompletion({
        prompt,
        max_tokens: maxTokens,
    });

    // Assuming the model returns each piece of information on a new line
    const extractedLines = response.choices[0].text.trim().split('\n');

    return {
        jobTitle: extractedLines[0],
        company: extractedLines[1],
        location: extractedLines[2],
        datePosted: extractedLines[3],
        status: extractedLines[4] || 'Applied', // default to "Applied" if not provided
    };
}

async function addJobPrompt() {
    // Step 1: Get the Indeed HTML content or URL (let's assume content for now)
    const { jobUrl } = await inquirer.prompt([
        {
            type: 'input',
            name: 'jobUrl',
            message: 'Enter the Indeed job listing URL:',
        },
    ]);

    // Fetch the HTML content
    let htmlContent;
    try {
        const response = await axios.get(jobUrl, {
            headers: {
                'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537',
            },
        });
        htmlContent = response.data;
    } catch (error) {
        console.error(`Failed to fetch HTML content.`);
        if (error.response) {
            // The request was made, and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(`Status Code: ${error.response.status}`);
            console.error(`Headers: ${JSON.stringify(error.response.headers)}`);
            console.error(`Data: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            // The request was made, but no response was received
            console.error(`Request was made but no response received.`);
            console.error(`Request: ${JSON.stringify(error.request)}`);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error', error.message);
        }
        return;
    }

    // Step 2: Extract job information
    const extractedInfo = await extractJobInfoFromIndeed(htmlContent);

    // Step 3: Confirm or modify the extracted data
    const confirmedInfo = await inquirer.prompt([
        {
            type: 'input',
            name: 'jobTitle',
            message: 'Job Title:',
            default: extractedInfo.jobTitle,
        },
        {
            type: 'input',
            name: 'company',
            message: 'Company:',
            default: extractedInfo.company,
        },
        {
            type: 'input',
            name: 'location',
            message: 'Location:',
            default: extractedInfo.location,
        },
        {
            type: 'input',
            name: 'url',
            message: 'Job URL:',
            default: extractedInfo.url, // Assuming you also extract URL in extractJobInfoFromIndeed
        },
        {
            type: 'input',
            name: 'datePosted',
            message: 'Date Posted:',
            default: extractedInfo.datePosted,
        },
        {
            type: 'list',
            name: 'status',
            message: 'Application Status:',
            choices: [
                'Applied',
                'Interview Scheduled',
                'Offer Received',
                'Rejected',
            ],
            default: extractedInfo.status || 'Applied', // Default to "Applied" if not provided
        },
    ]);

    // Step 4: Add the job to the database
    addJob(
        confirmedInfo.jobTitle,
        confirmedInfo.company,
        confirmedInfo.location,
        confirmedInfo.datePosted,
        confirmedInfo.status,
    );
}

function addJob(title, company, location, url, date_posted, status) {
    const insertQuery = `INSERT INTO jobs (title, company, location, url, date_posted, status) 
                         VALUES (?, ?, ?, ?, ?, ?)`;
    const jobData = [title, company, location, url, date_posted, status];

    db.run(insertQuery, jobData, function (err) {
        if (err) {
            return console.error(err.message);
        }
        console.log(`Inserted job with ID: ${this.lastID}`);
    });
}

function listJobs() {
    db.each('SELECT id, title, company, status FROM jobs', (err, row) => {
        if (err) {
            console.error(err.message);
        }
        console.log(row);
    });
}

function updateJobStatus(id, newStatus) {
    const sql = `UPDATE jobs SET status = ? WHERE id = ?`;
    db.run(sql, [newStatus, id], function (err) {
        if (err) {
            console.error(err.message);
        }
        console.log(`Row(s) updated: ${this.changes}`);
    });
}

function deleteJob(id) {
    const sql = `DELETE FROM jobs WHERE id = ?`;
    db.run(sql, id, function (err) {
        if (err) {
            console.error(err.message);
        }
        console.log(`Row(s) deleted: ${this.changes}`);
    });
}

function initializeDB() {
    const db = new sqlite3.Database('./jobSearchTracker.db', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the jobSearchTracker database.');
    });

    db.serialize(() => {
        db.run(
            'CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, company TEXT, status TEXT)',
        );
    });

    return db;
}

function mainMenu() {
    inquirer
        .prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    'Add Job',
                    'List Jobs',
                    'Update Job Status',
                    'Delete Job',
                    'Exit',
                ],
            },
        ])
        .then(async (answers) => {
            switch (answers.action) {
                case 'Add Job':
                    await addJobPrompt();
                    break;
                case 'List Jobs':
                    // Call function to list jobs
                    break;
                case 'Update Job Status':
                    // Call function to update job status
                    break;
                case 'Delete Job':
                    // Call function to delete a job
                    break;
                case 'Exit':
                    // Exit the application
                    db.close((err) => {
                        if (err) {
                            console.error(err.message);
                        }
                        console.log('Closed the database connection.');
                    });
                    return;
            }
            // Return to the main menu
            mainMenu();
        });
}

const db = initializeDB();
mainMenu();
