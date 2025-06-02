const express = require('express');
const axios = require('axios');
const multer = require('multer');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

//Simulation of jooble job returns, not real api job returns
const mockJobs = require('./joobleMock');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/upload-cv', upload.single('cvFile'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');

  const filePath = path.resolve(__dirname, req.file.path);
  const ext = path.extname(req.file.originalname).toLowerCase();

  if (ext !== '.docx') {
    fs.unlinkSync(filePath);
    return res.status(400).send('Only .docx files are supported.');
  }

  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    fs.unlinkSync(filePath);

    if (!text || text.trim().length === 0) {
      return res.status(400).send('Could not extract any text from the file.');
    }

    //Calling to ner model
    const entityRes = await axios.post('http://127.0.0.1:5000/extract', { text });
    const entities = entityRes?.data?.entities || [];

    const skills = [...new Set(entities.filter(ent => ent.label === 'SKILL').map(ent => ent.text))];
    const professions = [...new Set(entities.filter(ent => ent.label === 'DESIGNATION').map(ent => ent.text))];

    //Real Jooble API call (LIMITs) ---
    /*
    const joobleResponse = await axios.post('https://jooble.org/api/e2d56f66-79c7-4d8f-b29d-c3a03a39e6d1', {
      keywords: [...skills, ...professions].join(', '),
      location: 'UK', // or extract from CV
      page: 1
    });

    const realJobs = joobleResponse.data.jobs.slice(0, 10);
    */

    //////////////Using mock jobs instead of Jooble from const jooblemock file
   
//Call to local similarity model for each job
    const similarityScores = await Promise.all(
      mockJobs.jobs.map(async (job) => {
        const payload = {
          cv: text,
          job: `${job.title}. ${job.description} ${job.skills.join(' ')}`
        };

        const simRes = await axios.post('http://127.0.0.1:5001/similarity', payload);
        return {
          ...job,
          similarity: simRes.data.similarity
        };
      })
    );

    //Sorting(close to least close) by match score
    similarityScores.sort((a, b) => b.similarity - a.similarity);

    res.render('results', {
      cvText: text,
      jobs: similarityScores,
      skills,
      professions
    });

  } catch (err) {
    console.error('Error:', err.message);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).send('Failed to process the CV.');
  }
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});