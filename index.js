const express = require('express');
const multer = require('multer');
const fs = require('fs');
const mammoth = require('mammoth');

const app = express();
const PORT = 3000;

// Set up storage for file uploads
const upload = multer({ dest: 'uploads/' });

// Serve static files
app.use(express.static('public'));

// Store extracted data
let extractedData = {};

/* ----------------------------------------------------
   1. Email Extraction
   ---------------------------------------------------- */
function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return [...new Set(text.match(emailRegex) || [])];
}

/* ----------------------------------------------------
   2. Phone Number Extraction
   ---------------------------------------------------- */
function extractPhoneNumbers(text) {
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3}[-.\s]?\d{3,4}/g;
  return [...new Set(text.match(phoneRegex) || [])];
}

/* ----------------------------------------------------
   3. Job Title Extraction
   ---------------------------------------------------- */
function extractJobTitles(text) {
  const jobTitles = [
    "Software Developer", "Web Developer", "Engineer", "Manager",
    "Analyst", "Consultant", "Designer", "Technician", "Intern",
    "Architect", "Administrator", "Data Scientist", "AI Engineer",
    "DevOps Engineer", "Project Manager", "Product Manager",
    "Team Lead", "Systems Engineer", "Full Stack Developer",
    "Backend Developer", "Frontend Developer", "Security Engineer",
    "Cloud Engineer", "Database Administrator"
  ];

  const jobTitleRegex = new RegExp(jobTitles.join("|"), "gi");
  return [...new Set(text.match(jobTitleRegex) || [])];
}

/* ----------------------------------------------------
   4. Skill Extraction
   ---------------------------------------------------- */
function extractSkills(text) {
  const skillsList = [
    "JavaScript", "React.js", "Node.js", "SQL", "HTML", "CSS", "Python",
    "C++", "Java", "Django", "Flask", "Spring", "Kotlin", "TypeScript",
    "Swift", "Ruby", "PHP", "Rust", "Go", "TensorFlow", "PyTorch",
    "AWS", "Docker", "Kubernetes", "GraphQL", "MongoDB", "PostgreSQL",
    "MySQL", "Firebase", "Linux", "Git", "CI/CD", "Agile", "Scrum",
    "Vue.js", "Angular", "Machine Learning", "Deep Learning", "Big Data",
    "Hadoop", "Spark", "Cloud Computing", "Data Science"
  ];

  return skillsList.filter(skill => text.toLowerCase().includes(skill.toLowerCase()));
}

/* ----------------------------------------------------
   5. Keyword Extraction
   ---------------------------------------------------- */
function extractKeywords(text) {
  const stopwords = new Set([
    "the", "and", "to", "in", "for", "on", "with", "at", "by", "an", "a", "of", "is",
    "this", "that", "email", "phone", "address", "available", "upon", "request",
    "references", "com", "fake", "street", "about", "professional", "summary",
    "motivated", "passionate", "highly"
  ]);

  let words = text.toLowerCase().match(/\b[a-zA-Z]{3,}\b/g) || [];
  words = words.filter(word => !stopwords.has(word));

  return [...new Set(words)].slice(0, 20);
}

/* ----------------------------------------------------
   6. Cosine Similarity Function
   ---------------------------------------------------- */
function cosineSimilarity(resumeKeywords, jobKeywords) {
  let words1 = new Set(resumeKeywords);
  let words2 = new Set(jobKeywords);
  let allWords = new Set([...words1, ...words2]);

  let vector1 = [], vector2 = [];

  allWords.forEach(word => {
    vector1.push(words1.has(word) ? 1 : 0);
    vector2.push(words2.has(word) ? 1 : 0);
  });

  let dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
  let magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
  let magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));

  return magnitude1 === 0 || magnitude2 === 0 ? 0 : dotProduct / (magnitude1 * magnitude2);
}

/* ----------------------------------------------------
   7. Mock Job API (Simulating Real Job API)
   ---------------------------------------------------- */
const jobDescriptions = [
  {
    title: "Web Developer",
    description: "Looking for a Web Developer proficient in JavaScript, React, Node.js, and SQL.",
    keywords: ["web", "developer", "javascript", "react", "node", "sql"]
  },
  {
    title: "Machine Learning Engineer",
    description: "Machine Learning Engineer needed with skills in Python, TensorFlow, and AI.",
    keywords: ["machine", "learning", "python", "tensorflow", "ai", "models"]
  },
  {
    title: "Cloud Engineer",
    description: "Seeking a Cloud Engineer with expertise in AWS, Kubernetes, and CI/CD pipelines.",
    keywords: ["cloud", "aws", "kubernetes", "ci/cd", "terraform", "devops"]
  },
  {
    title: "Data Scientist",
    description: "Hiring a Data Scientist with experience in data analytics, Python, and big data.",
    keywords: ["data", "science", "python", "big data", "hadoop", "spark"]
  }
];

/* ----------------------------------------------------
   8. Resume Processing + Job Matching API
   ---------------------------------------------------- */
app.post('/upload', upload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const filePath = req.file.path;
  let extractedText = "";

  try {
    if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractedText = await mammoth.extractRawText({ path: filePath })
        .then(result => result.value.trim())
        .catch(err => {
          console.error("❌ Error processing .docx file:", err);
          return res.status(500).json({ message: "Error processing .docx file." });
        });
    } else {
      extractedText = fs.readFileSync(filePath, 'utf8').trim();
    }

    extractedData = {
      emails: extractEmails(extractedText),
      phoneNumbers: extractPhoneNumbers(extractedText),
      jobTitles: extractJobTitles(extractedText),
      skills: extractSkills(extractedText),
      keywords: extractKeywords(extractedText)
    };

    let scoredJobs = jobDescriptions.map(job => ({
      title: job.title,
      description: job.description,
      score: cosineSimilarity(extractedData.keywords, job.keywords)
    }));

    scoredJobs.sort((a, b) => b.score - a.score);

    fs.unlinkSync(filePath);

    res.json({ message: "File processed successfully!", extractedData, jobs: scoredJobs });
  } catch (error) {
    console.error("❌ Error processing file:", error);
    res.status(500).json({ message: "Error processing file." });
  }
});

/* ----------------------------------------------------
   9. JSON API Endpoint to View Extracted Data
   ---------------------------------------------------- */
app.get('/keywords', (req, res) => {
  if (Object.keys(extractedData).length === 0) {
    return res.status(404).json({ message: "No data available. Upload a file first!" });
  }
  res.json(extractedData);
});

/* ----------------------------------------------------
   10. Start the Server
   ---------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});