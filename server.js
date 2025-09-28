const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'baete_evaluations.db');
const db = new Database(dbPath);

// Create tables if they don't exist
// Evaluations table
db.exec(`CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_name TEXT NOT NULL,
    university_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Criteria table
db.exec(`CREATE TABLE IF NOT EXISTS criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_id INTEGER,
    criterion_index INTEGER,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'Not Started',
    evaluation TEXT,
    justification TEXT,
    FOREIGN KEY (evaluation_id) REFERENCES evaluations (id)
)`);

// Sub-criteria table
db.exec(`CREATE TABLE IF NOT EXISTS sub_criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    criterion_id INTEGER,
    sub_criterion_index INTEGER,
    text TEXT NOT NULL,
    evaluation TEXT,
    FOREIGN KEY (criterion_id) REFERENCES criteria (id)
)`);

// Responses table
db.exec(`CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sub_criterion_id INTEGER,
    question_index INTEGER,
    response TEXT,
    FOREIGN KEY (sub_criterion_id) REFERENCES sub_criteria (id)
)`);

// Load criteria data from JSON file
let criteriaData = [];
try {
    const criteriaDataRaw = fs.readFileSync(path.join(__dirname, 'criteriaData.json'), 'utf8');
    criteriaData = JSON.parse(criteriaDataRaw);
    console.log('Criteria data loaded successfully');
} catch (error) {
    console.error('Error loading criteria data:', error);
}

// API Routes

// Get all evaluations
app.get('/api/evaluations', (req, res) => {
    try {
        const query = `
            SELECT e.*, 
                   COUNT(CASE WHEN c.status = 'Completed' THEN 1 END) as completed_criteria,
                   COUNT(c.id) as total_criteria
            FROM evaluations e
            LEFT JOIN criteria c ON e.id = c.evaluation_id
            GROUP BY e.id
            ORDER BY e.updated_at DESC
        `;
        
        const rows = db.prepare(query).all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get specific evaluation with all details
app.get('/api/evaluations/:id', (req, res) => {
    try {
        const evaluationId = req.params.id;
        
        const evaluationQuery = db.prepare('SELECT * FROM evaluations WHERE id = ?');
        const evaluation = evaluationQuery.get(evaluationId);
        
        if (!evaluation) {
            res.status(404).json({ error: 'Evaluation not found' });
            return;
        }

        // Get criteria for this evaluation
        const criteriaQuery = db.prepare(`
            SELECT c.*, sc.id as sc_id, sc.sub_criterion_index, sc.text as sc_text, 
                   sc.evaluation as sc_evaluation, r.question_index, r.response
            FROM criteria c
            LEFT JOIN sub_criteria sc ON c.id = sc.criterion_id
            LEFT JOIN responses r ON sc.id = r.sub_criterion_id
            WHERE c.evaluation_id = ?
            ORDER BY c.criterion_index, sc.sub_criterion_index, r.question_index
        `);
        
        const rows = criteriaQuery.all(evaluationId);

        // Transform the flat result into nested structure
        const criteria = [];
        const criteriaMap = new Map();
        
        rows.forEach(row => {
            if (!criteriaMap.has(row.criterion_index)) {
                criteriaMap.set(row.criterion_index, {
                    title: row.title,
                    status: row.status,
                    evaluation: row.evaluation,
                    justification: row.justification,
                    sub_criteria: []
                });
                criteria[row.criterion_index] = criteriaMap.get(row.criterion_index);
            }
            
            const criterion = criteriaMap.get(row.criterion_index);
            
            if (row.sc_id && !criterion.sub_criteria[row.sub_criterion_index]) {
                criterion.sub_criteria[row.sub_criterion_index] = {
                    text: row.sc_text,
                    evaluation: row.sc_evaluation,
                    responses: []
                };
            }
            
            if (row.question_index !== null) {
                const subCriterion = criterion.sub_criteria[row.sub_criterion_index];
                subCriterion.responses[row.question_index] = row.response;
            }
        });

        // Fill in missing responses with null values based on criteriaData
        criteria.forEach((criterion, criterionIndex) => {
            if (criterion && criteriaData[criterionIndex]) {
                criteriaData[criterionIndex].sub_criteria.forEach((templateSc, scIndex) => {
                    if (criterion.sub_criteria[scIndex]) {
                        // Ensure responses array has correct length
                        const responses = criterion.sub_criteria[scIndex].responses;
                        for (let i = 0; i < templateSc.questions.length; i++) {
                            if (responses[i] === undefined) {
                                responses[i] = null;
                            }
                        }
                    }
                });
            }
        });

        const result = {
            ...evaluation,
            criteria: criteria
        };
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new evaluation
app.post('/api/evaluations', (req, res) => {
    const { programName, universityName } = req.body;
    
    if (!programName || !universityName) {
        res.status(400).json({ error: 'Program name and university name are required' });
        return;
    }

    try {
        const insertEvaluation = db.prepare('INSERT INTO evaluations (program_name, university_name) VALUES (?, ?)');
        const result = insertEvaluation.run(programName, universityName);
        const evaluationId = result.lastInsertRowid;
        
        // Create criteria and sub-criteria based on criteriaData
        const insertCriterion = db.prepare('INSERT INTO criteria (evaluation_id, criterion_index, title) VALUES (?, ?, ?)');
        const insertSubCriterion = db.prepare('INSERT INTO sub_criteria (criterion_id, sub_criterion_index, text) VALUES (?, ?, ?)');
        
        criteriaData.forEach((criterion, criterionIndex) => {
            const criterionResult = insertCriterion.run(evaluationId, criterionIndex, criterion.title);
            const criterionId = criterionResult.lastInsertRowid;
            
            criterion.sub_criteria.forEach((subCriterion, subIndex) => {
                insertSubCriterion.run(criterionId, subIndex, subCriterion.text);
            });
        });
        
        res.json({ 
            id: evaluationId, 
            program_name: programName, 
            university_name: universityName,
            message: 'Evaluation created successfully' 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update criterion
app.put('/api/evaluations/:evalId/criteria/:criterionIndex', (req, res) => {
    const { evalId, criterionIndex } = req.params;
    const { status, evaluation, justification } = req.body;
    
    try {
        const updateCriterion = db.prepare(`
            UPDATE criteria 
            SET status = ?, evaluation = ?, justification = ?
            WHERE evaluation_id = ? AND criterion_index = ?
        `);
        
        const result = updateCriterion.run(status, evaluation, justification, evalId, criterionIndex);
        
        // Update evaluation timestamp
        const updateEvaluation = db.prepare('UPDATE evaluations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        updateEvaluation.run(evalId);
        
        res.json({ message: 'Criterion updated successfully', changes: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update sub-criterion
app.put('/api/evaluations/:evalId/criteria/:criterionIndex/sub-criteria/:subIndex', (req, res) => {
    const { evalId, criterionIndex, subIndex } = req.params;
    const { evaluation, responses } = req.body;
    
    try {
        // First get the criterion_id and sub_criterion_id
        const getIds = db.prepare(`
            SELECT c.id as criterion_id, sc.id as sub_criterion_id
            FROM criteria c
            JOIN sub_criteria sc ON c.id = sc.criterion_id
            WHERE c.evaluation_id = ? AND c.criterion_index = ? AND sc.sub_criterion_index = ?
        `);
        
        const row = getIds.get(evalId, criterionIndex, subIndex);
        
        if (!row) {
            res.status(404).json({ error: 'Sub-criterion not found' });
            return;
        }
        
        // Update sub-criterion evaluation
        const updateSubCriterion = db.prepare('UPDATE sub_criteria SET evaluation = ? WHERE id = ?');
        updateSubCriterion.run(evaluation, row.sub_criterion_id);
        
        // Delete existing responses
        const deleteResponses = db.prepare('DELETE FROM responses WHERE sub_criterion_id = ?');
        deleteResponses.run(row.sub_criterion_id);
        
        // Insert new responses
        const insertResponse = db.prepare('INSERT INTO responses (sub_criterion_id, question_index, response) VALUES (?, ?, ?)');
        responses.forEach((response, index) => {
            if (response !== null) {
                insertResponse.run(row.sub_criterion_id, index, response);
            }
        });
        
        // Update evaluation timestamp
        const updateEvaluation = db.prepare('UPDATE evaluations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        updateEvaluation.run(evalId);
        
        res.json({ message: 'Sub-criterion updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get criteria data
app.get('/api/criteria-data', (req, res) => {
    res.json(criteriaData);
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`BAETE Evaluator server running on http://localhost:${PORT}`);
    console.log(`Database: ${dbPath}`);
});

// Gracefully close database connection on exit
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    try {
        db.close();
        console.log('Database connection closed.');
    } catch (err) {
        console.error('Error closing database:', err.message);
    }
    process.exit(0);
});