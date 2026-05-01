console.log("🔥 SERVER FILE IS RUNNING");

require('dotenv').config();
// const { GoogleGenerativeAI } = require("@google/generative-ai");

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// const model = genAI.getGenerativeModel({
//     model: "gemini-2.0-flash"
// });
const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

const app = express();
const PORT = process.env.PORT || 5050;

// ====== CORS Configuration ======
app.use(cors({
    origin: [
        'http://localhost:5050',
        'http://127.0.0.1:5050',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:4000',
        'http://127.0.0.1:4000',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ====== MySQL Connection Pool ======
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',        
    password: process.env.DB_PASSWORD || '',    
    database: process.env.DB_NAME || 'interviewprep',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test DB connection on startup
// async function testDatabaseConnection() {
//     try {
//         const connection = await pool.getConnection();
//         console.log(' Database connected successfully');
//         connection.release();
//     } catch (err) {
//         console.error('Database connection failed:', err.message);
//         process.exit(1);
//     }
// }

async function testDatabaseConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
    } catch (err) {
        console.error('⚠️ Database connection failed:', err.message);
        console.log('⚠️ Continuing without database for deployment demo...');
    }
}

// app.get('/api/test-gemini', async (req, res) => {
//     try {
//         const result = await model.generateContent("Say hello");
//         const response = await result.response;
//         const text = response.text();

//         res.send(text);

//     } catch (err) {
//         console.error(err);
//         res.status(500).send(err.message);
//     }
// });

app.get('/test', (req, res) => {
    console.log("TEST ROUTE HIT");
    res.send("Test route working");
});

// ====== Routes ======
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ====== Authentication APIs ======

app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Email and password are required'
        });
    }

    try {
        // Check existing user first
        const [existingUsers] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Email already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO users (email, password) VALUES (?, ?)',
            [email, hashedPassword]
        );

        // Generate token immediately
        const token = jwt.sign(
            {
                userId: result.insertId,
                email
            },
            JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );

        res.json({
            success: true,
            message: "User registered successfully",
            token,
            user: {
                id: result.insertId,
                email
            }
        });

    } catch (err) {
        console.error('Register error:', err);

        res.status(500).json({
            success: false,
            error: 'Registration failed'
        });
    }
});

// Login user
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Email and password are required'
        });
    }

    try {
        // Check if email exists
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        // USER NOT FOUND
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = rows[0];

        // CHECK PASSWORD
        const match = await bcrypt.compare(password, user.password);

        // WRONG PASSWORD
        if (!match) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // SUCCESS
        return res.status(200).json({
            success: true,
            userId: user.id,
            email: user.email,
            message: 'Login successful'
        });

    } catch (err) {
        console.error('Login error:', err);

        return res.status(500).json({
            success: false,
            error: 'Server error during login'
        });
    }
});
// ====== Simple Auth Check ======
app.get('/api/check-auth', (req, res) => {
    res.json({ authenticated: false }); // placeholder
});

// // ====== Hugging Face API for evaluating answers ======
// const HF_API_KEY = process.env.HF_API_KEY;
// const MODEL = process.env.HF_MODEL || 'mistralai/Mistral-7B-Instruct-v0.1';

// if (!HF_API_KEY) {
//     console.error('Set HF_API_KEY in .env');
//     process.exit(1);
// }

// app.get('/api/list-models', async (req, res) => {
//     try {
//         const result = await fetch(
//             `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
//         );

//         const data = await result.json();

//         res.json(data);
//     } catch (err) {
//         console.error(err);
//         res.status(500).send(err.message);
//     }
// });

// app.get('/api/models', async (req, res) => {
//     try {
//         const models = await genAI.listModels();
//         res.json(models);
//     } catch (err) {
//         console.error(err);
//         res.status(500).send(err.message);
//     }
// });

// app.post('/api/evaluate', async (req, res) => {
//     try {
//         const { question, answer } = req.body;

//         const prompt = `
// Evaluate this interview answer.

// Question: ${question}
// Answer: ${answer}

// Give:
// 1. Score out of 10
// 2. Strengths
// 3. Weaknesses
// 4. Improved Answer
// `;

//         const result = await model.generateContent(prompt);
//         const response = await result.response;
//         const text = response.text();

//         res.json({ feedback: text });

//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: err.message });
//     }
// });

app.post('/api/evaluate', (req, res) => {

    const feedback = {
        score: 8,
        summary: "Good answer with clear explanation.",
        strengths: [
            "Good confidence",
            "Clear communication",
            "Relevant example"
        ],
        improvements: [
            "Add more technical details",
            "Keep answer concise",
            "Improve conclusion"
        ],
        follow_up: "Can you explain your project experience?"
    };

    res.json({
        status: "success",
        feedback
    });
});

// app.get('/api/generate-question', async (req, res) => {
//     try {
//         const { topic = "Software Engineering", difficulty = "easy" } = req.query;

//         const prompt = `
// Generate one ${difficulty} level ${topic} interview question.

// Return:
// - Question
// - Sample Answer
// - Difficulty
// - Topic
// `;

//         const result = await model.generateContent(prompt);
//         const response = await result.response;
//         const text = response.text();

//         res.json({ result: text });

//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: err.message });
//     }
// });

app.get('/api/generate-question', (req, res) => {

    const questions = [
        "Tell me about yourself.",
        "What are your strengths?",
        "Why should we hire you?",
        "Describe a challenging situation.",
        "Where do you see yourself in 5 years?"
    ];

    const randomQuestion =
        questions[Math.floor(Math.random() * questions.length)];

    res.json({
        result: randomQuestion
    });
});


// ====== Judge0 API proxy ======
app.post('/api/run', async (req, res) => {
    try {
        const { source_code, language_id } = req.body;
        if (!source_code || !language_id) {
            return res.status(400).json({ error: "source_code and language_id are required" });
        }

        const response = await axios.post(
            'https://ce.judge0.com/submissions?base64_encoded=false&wait=true',
            { source_code, language_id: parseInt(language_id), stdin: "" },
            { headers: { 'Content-Type': 'application/json' } }
        );

        res.json(response.data);
    } catch (err) {
        console.error('Judge0 error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Execution failed', details: err.response?.data || err.message });
    }
});


// STEP 3: ADD THIS TO server.js



app.post('/api/save-profile', async (req, res) => {
    const {
        education,
        fieldOfStudy,
        graduationYear,
        careerStatus,
        targetRole,
        experienceLevel,
        targetCompanies,
        timeline,
        focusArea
    } = req.body;

    try {
        const [result] = await pool.query(
            `INSERT INTO user_profiles 
            (education, field_of_study, graduation_year, career_status, target_role, experience_level, target_companies, timeline, focus_area)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                education,
                fieldOfStudy,
                graduationYear,
                careerStatus,
                targetRole,
                experienceLevel,
                targetCompanies,
                timeline,
                focusArea
            ]
        );

        res.status(200).json({
            success: true,
            message: "Profile completed successfully!",
            profileId: result.insertId
        });

    } catch (err) {
        console.error("Profile save error:", err);
        res.status(500).json({
            success: false,
            error: "Database save failed"
        });
    }
});
       
// ====== Start server ======
// app.listen(PORT, async () => {
//     console.log(`Server running at http://localhost:${PORT}`);
//     await testDatabaseConnection();
// });

app.listen(PORT, async () => {
    console.log(`✅ Server running on port ${PORT}`);
    await testDatabaseConnection();
});

process.on('SIGINT', () => {
    console.log('\nServer shutting down gracefully');
    process.exit(0);
});

app.post('/api/mark-solved', async (req, res) => {
    const { userId, problemId, difficulty } = req.body;

    if (!userId || !problemId || !difficulty) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields"
        });
    }

    try {
        // Prevent duplicate solve
        const [existing] = await pool.query(
            'SELECT * FROM solved_problems WHERE user_id = ? AND problem_id = ?',
            [userId, problemId]
        );

        if (existing.length > 0) {
            return res.json({
                success: true,
                message: "Problem already solved"
            });
        }

        await pool.query(
            'INSERT INTO solved_problems (user_id, problem_id, difficulty) VALUES (?, ?, ?)',
            [userId, problemId, difficulty]
        );

        res.json({
            success: true,
            message: "Problem marked as solved!"
        });

    } catch (err) {
        console.error("Mark solved error:", err);
        res.status(500).json({
            success: false,
            error: "Database error"
        });
    }
});

app.get('/api/progress/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        const [rows] = await pool.query(
            `SELECT 
                COUNT(*) AS totalSolved,
                SUM(difficulty='Easy') AS easySolved,
                SUM(difficulty='Medium') AS mediumSolved,
                SUM(difficulty='Hard') AS hardSolved
             FROM solved_problems
             WHERE user_id = ?`,
            [userId]
        );

        res.json({
            success: true,
            progress: rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: "Failed to fetch progress"
        });
    }
});