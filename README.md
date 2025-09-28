# BAETE Mobile Evaluator

A web-based application for conducting accreditation evaluations for engineering programs against BAETE (Board for Accreditation of Engineering and Technical Education) criteria.

## Features

- **11 Major Criteria** evaluation framework
- **SQLite Database** for persistent data storage
- **Structured Question-Response** system with Yes/No answers
- **Automated Evaluation Logic** based on BAETE standards
- **Progress Tracking** and comprehensive reporting
- **Export Functionality** for evaluation summaries

## Technology Stack

### Backend
- **Node.js** with Express framework
- **better-sqlite3** for SQLite database operations
- **CORS** enabled for cross-origin requests

### Frontend
- **Vue.js 3** (Composition API)
- **Tailwind CSS** for styling
- **Vanilla JavaScript** with modern ES6+ features

### Database Schema
- **evaluations** - Main evaluation records
- **criteria** - Evaluation criteria with status and justification
- **sub_criteria** - Detailed sub-criteria with individual evaluations
- **responses** - Yes/No responses to specific questions

## Setup and Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Installation Steps

1. **Clone or navigate to the project directory**
   ```bash
   cd /path/to/baete-eval
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   # or
   node server.js
   ```

4. **Access the application**
   Open your browser and go to: `http://localhost:3000`

## Usage

### Starting a New Evaluation
1. Click "Start New Evaluation" on the dashboard
2. Enter the program name and university name
3. Click "Create" to initialize the evaluation

### Conducting the Evaluation
1. Select an evaluation from the dashboard
2. Work through each criterion by clicking on them
3. Answer Yes/No questions for each sub-criterion
4. Review and accept/override the proposed evaluations
5. Add justifications for overall criterion evaluations

### Exporting Results
1. Complete all criteria evaluations
2. Go to "Final Summary"
3. Click "Export as Text" to download the report

## API Endpoints

### Evaluations
- `GET /api/evaluations` - List all evaluations
- `GET /api/evaluations/:id` - Get specific evaluation with details
- `POST /api/evaluations` - Create new evaluation

### Criteria Management
- `PUT /api/evaluations/:evalId/criteria/:criterionIndex` - Update criterion
- `PUT /api/evaluations/:evalId/criteria/:criterionIndex/sub-criteria/:subIndex` - Update sub-criterion

### Data
- `GET /api/criteria-data` - Get BAETE criteria structure

## Database

The application uses SQLite for data persistence. The database file (`baete_evaluations.db`) is created automatically in the project directory.

### Key Tables:
- **evaluations**: Stores basic evaluation information
- **criteria**: Stores criterion-level data and evaluations
- **sub_criteria**: Stores sub-criterion details and evaluations
- **responses**: Stores individual Yes/No question responses

## Configuration

### Criteria Data
The evaluation criteria are defined in `criteriaData.json`. This file contains:
- 11 main criteria categories
- Sub-criteria for each category
- Questions derived directly from BAETE requirements

### Server Configuration
- **Port**: 3000 (configurable via PORT environment variable)
- **Database**: SQLite file in project directory
- **CORS**: Enabled for all origins in development

## Development

### Adding New Criteria
1. Edit `criteriaData.json` to add or modify criteria
2. Restart the server to reload the criteria data
3. New evaluations will use the updated criteria structure

### Database Management
The SQLite database is automatically created and managed. For manual inspection:
```bash
sqlite3 baete_evaluations.db
.tables
.schema
```

## Evaluation Logic

### Response Evaluation
- **Yes/No Responses**: Simple binary choices for all questions
- **Percentage-based Evaluation**: Uses ratio of "No" responses to determine evaluation level

### Criteria Types
- **"Must" Criteria**: Stricter evaluation (any "No" responses are serious)
  - ≥50% No → Deficiency
  - >25% No → Weakness  
  - >0% No → Concern
  - 0% No → Compliance

- **"Should" Criteria**: More lenient evaluation
  - ≥75% No → Weakness
  - ≥50% No → Concern
  - <50% No → Compliance

## File Structure

```
baete-eval/
├── server.js              # Node.js backend server
├── package.json           # Node.js dependencies
├── criteriaData.json      # BAETE criteria definitions
├── index.html             # Frontend application
├── baete_evaluations.db   # SQLite database (auto-created)
└── README.md             # This file
```

## Troubleshooting

### Server Won't Start
- Check if port 3000 is already in use
- Verify Node.js and npm are installed
- Run `npm install` to ensure dependencies are installed

### Database Issues
- Delete `baete_evaluations.db` to reset the database
- Check file permissions in the project directory

### Frontend Issues
- Ensure the server is running on port 3000
- Check browser console for JavaScript errors
- Verify the API base URL in `index.html` matches the server port

## License

MIT License - See LICENSE file for details.