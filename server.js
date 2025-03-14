const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
require('dotenv').config();
const async = require('async');
const WebSocket = require('ws');
const app = express();
const router = express.Router();
const server = http.createServer(app); // Create HTTP server

// Middleware
app.use(cors({
  origin: ["http://127.0.0.1:8080", "http://localhost:8080"],  // Match Socket.io origins
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.options('*', cors()); // Allow preflight requests

/*
this code create a folder called uploads in the root of the project
and save the file in it.
*/ 
// Configure multer for file uploads// Ensure the uploads directory exists
const uploadsPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// ✅ Proper Multer Storage Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsPath); // Correct storage path
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({ storage: storage });

// ✅ Serve uploaded files as static
app.use("/uploads", express.static(uploadsPath));

// ✅ Create a WebSocket server
const wss = new WebSocket.Server({ port: 3002 });
const clients = new Map();
console.log("✅ WebSocket server running on ws://localhost:3002");

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to MySQL database.');
  }
});

/*This code is a security check for protected routes in an Express app. */
// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'Access Denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid Token' });
    req.user = user;
    next();
  });
};

/*this code will get profile that we have save and show it after we login
It will show about me, project, recommandations and contact me section */
// Get Profile Data with Recommendations
app.get('/get-profile', (req, res) => {
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  // Fetch profile, projects, contact, and recommendations
  const query = `
    SELECT a.about_me_text, 
           p.title AS project_title, p.description AS project_description, 
           c.contact_email, c.linkedin_profile
    FROM about_me a
    LEFT JOIN projects p ON a.user_id = p.employee_id
    LEFT JOIN contact_me c ON a.user_id = c.user_id
    WHERE a.user_id = ?;
  `;

  const recommendationsQuery = `
    SELECT e.company_name AS employer_name, r.message AS recommendation_text, r.rating
    FROM recommendations r
    JOIN employers e ON r.employer_id = e.id
    WHERE r.employee_id = ?;
  `;

  db.query(query, [userId], (err, profileResults) => {
    if (err) {
      console.error("Error fetching profile data:", err);
      return res.status(500).json({ error: "Error fetching profile data" });
    }

    db.query(recommendationsQuery, [userId], (err, recommendationResults) => {
      if (err) {
        console.error("Error fetching recommendations:", err);
        return res.status(500).json({ error: "Error fetching recommendations" });
      }

      const profileData = profileResults.length > 0 ? profileResults[0] : {};
      profileData.recommendations = recommendationResults; // Add recommendations

      res.json(profileData);
    });
  });
});


// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET;


/*This endpoint is use to handle the backend of create employee account.
It check if all the fields is full. Then it will check it the user name and password already there in the db.
If not there in the database then it will insert it in the db.  */
//create employee account
app.post('/create-employee-account', (req, res) => {
  console.log('📥 Request received:', req.body);

  const { fullname, email, username, password } = req.body;
  if (!fullname || !email || !username || !password) {
      console.log('⚠️ Missing required fields');
      return res.status(400).json({ message: 'All fields are required.' });
  }

  // Check if user already exists (by username or email)
  const checkSql = 'SELECT * FROM employees WHERE username = ? OR email = ?';
  db.query(checkSql, [username, email], (err, results) => {
      if (err) {
          console.error('⚠️ Database query error:', err);
          return res.status(500).json({ message: 'Error checking user.', error: err });
      }

      if (results.length > 0) {
          console.log('⚠️ Username or email already exists');
          return res.status(409).json({ message: 'Username or email already exists.' });
      }

      // Hash password before storing
      bcrypt.hash(password, 10, (err, hash) => {
          if (err) {
              console.error('⚠️ Error hashing password:', err);
              return res.status(500).json({ message: 'Error hashing password.', error: err });
          }

          // Insert into database
          const sql = 'INSERT INTO employees (full_name, email, username, password) VALUES (?, ?, ?, ?)';
          db.query(sql, [fullname, email, username, hash], (err, result) => {
              if (err) {
                  console.error('⚠️ Error creating account:', err);
                  return res.status(500).json({ message: 'Error creating account.', error: err });
              }

              console.log('✅ Employee account created:', result);
              res.status(201).json({ message: 'Employee account created.' });
          });
      });
  });
});


/*Similary to employee acc */
// Create Employer Account Endpoint
app.post("/create-employer-account", async (req, res) => {
  const { company_name, email, username, password } = req.body;

  if (!company_name || !email || !username || !password) {
      return res.status(400).json({ message: "All fields are required." });
  }

  try {
      const checkQuery = "SELECT * FROM employers WHERE email = ? OR username = ?";

      db.query(checkQuery, [email, username], async (err, results) => {
          if (err) {
              return res.status(500).json({ message: "Server error" });
          }

          if (results.length > 0) {
              return res.status(400).json({ message: "Email or Username already exists." });
          }

          const hashedPassword = await bcrypt.hash(password, 10);

          const insertQuery = "INSERT INTO employers (company_name, email, username, password) VALUES (?, ?, ?, ?)";

          db.query(insertQuery, [company_name, email, username, hashedPassword], (err, result) => {
              if (err) {
                  return res.status(500).json({ message: "Error creating employer account" });
              }

              res.status(201).json({ message: "Employer account created successfully!" });
          });
      });

  } catch (error) {
      res.status(500).json({ message: "Internal Server Error" });
  }
});


/*For login this will check in the db where the username is ?(the id).
If it matches in db it will open the employee page */
// Employee Login
app.post('/employee-login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send('Username and password are required.');
  }

  const sql = 'SELECT * FROM employees WHERE username = ?';
  db.query(sql, [username], (err, results) => {
    if (err) return res.status(500).send('Error during login.');
    if (results.length === 0) return res.status(401).send('Invalid credentials.');

    const user = results[0];
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) return res.status(500).send('Error comparing passwords.');
      if (!match) return res.status(401).send('Invalid credentials.');

      const token = jwt.sign({ id: user.id, role: 'employee' }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, userId: user.id });  // Send userId along with the token
    });
  });
});

/*Similary as employee login */
//Employer login
app.post('/employer-login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send('Username and password are required.');
  }

  const sql = 'SELECT * FROM employers WHERE username = ?';
  db.query(sql, [username], (err, results) => {
    if (err) return res.status(500).send('Error during login.');
    if (results.length === 0) return res.status(401).send('Invalid credentials.');

    const employer = results[0];
    bcrypt.compare(password, employer.password, (err, match) => {
      if (err) return res.status(500).send('Error comparing passwords.');
      if (!match) return res.status(401).send('Invalid credentials.');

      const token = jwt.sign({ id: employer.id, role: 'employer' }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, userId: employer.id });  // Send userId along with the token
    });
  });
});



// WebSocket chat logic (for real-time communication)
// ✅ Store connected users with their WebSocket clients
wss.on("connection", (ws) => {
    console.log("✅ New WebSocket Connection Established");

    ws.on("message", async (message) => {
        try {
            const data = JSON.parse(message);

            // ✅ Handle authentication
            if (data.type === "authenticate") {
                if (!data.userId || !data.role) {
                    console.error("❌ Authentication failed: Missing userId or role", data);
                    return;
                }

                ws.userId = data.userId;
                ws.role = data.role;
                const userKey = `${data.role}_${data.userId}`;

                clients.set(userKey, ws);
                console.log(`✅ User authenticated: ${userKey}`);
                return;
            }

            // ✅ Handle chat messages
            if (data.type === "chat_message") {
                let { sender, employerId, employeeId, message } = data;

                if (!sender || !employerId || !employeeId || !message) {
                    console.error("❌ Invalid chat message data:", data);
                    return;
                }

                employerId = employerId ? parseInt(employerId) : null;
                employeeId = employeeId ? parseInt(employeeId) : null;

                // ✅ Store message in database
                const insertQuery = `
                    INSERT INTO messages (employer_id, employee_id, sender, message) 
                    VALUES (?, ?, ?, ?)
                `;
                db.query(insertQuery, [employerId, employeeId, sender, message], (err, result) => {
                    if (err) {
                        console.error("❌ Error storing message:", err);
                        return;
                    }
                    console.log(`✅ Message stored in DB (ID: ${result.insertId})`);

                    // ✅ Fetch sender name
                    const senderTable = sender === "employer" ? "employers" : "employees";
                    const senderColumn = sender === "employer" ? "company_name" : "full_name";
                    const senderId = sender === "employer" ? employerId : employeeId;

                    db.query(
                        `SELECT ${senderColumn} AS name FROM ${senderTable} WHERE id = ?`,
                        [senderId],
                        (err, result) => {
                            let senderName = sender === "employer" ? "Employer" : "Employee";
                            if (!err && result.length > 0) {
                                senderName = result[0].name;
                            } else {
                                console.error("❌ Error fetching sender name:", err);
                            }

                            console.log(`🟢 Sender Name Fetched: ${senderName}`);

                            // ✅ Find recipient WebSocket using correct key
                            const recipientRole = sender === "employer" ? "employee" : "employer";
                            const recipientId = recipientRole === "employer" ? employerId : employeeId;

                            // ✅ Ensure recipientId is valid before looking up WebSocket
                            if (!recipientId) {
                                console.warn("⚠️ Recipient ID is missing, message won't be sent.");
                                return;
                            }

                            const recipientKey = `${recipientRole}_${recipientId}`;
                            const recipientSocket = clients.get(recipientKey);

                            const chatMessage = {
                                type: "chat_message",
                                sender: sender,
                                senderName: senderName,
                                employerId: employerId,
                                employeeId: employeeId,
                                message: message
                            };

                            // ✅ Send message to recipient (if online)
                            if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
                                console.log(`🚀 Sending message to ${recipientKey}: ${message}`);
                                recipientSocket.send(JSON.stringify(chatMessage));
                            } else {
                                console.warn(`⚠️ Recipient (${recipientKey}) is not connected`);
                            }
                        }
                    );
                });
            }
        } catch (err) {
            console.error("❌ WebSocket Message Handling Error:", err);
        }
    });

    ws.on("close", () => {
        if (ws.userId && ws.role) {
            const userKey = `${ws.role}_${ws.userId}`;
            console.log(`❌ WebSocket Disconnected (User: ${userKey})`);
            clients.delete(userKey);
        } else {
            console.log("❌ WebSocket Disconnected (User: undefined_undefined)");
        }
    });
});

// Get chat messages between employer and employee
app.get("/get-messages/:employerId/:employeeId", (req, res) => {
  const { employerId, employeeId } = req.params;

  const query = `
      SELECT employer_id, employee_id, sender, message, timestamp 
      FROM messages 
      WHERE (employer_id = ? AND employee_id = ?)
      ORDER BY timestamp ASC
  `;

  db.query(query, [employerId, employeeId], (err, results) => {
      if (err) {
          console.error("❌ Database error:", err);
          return res.status(500).json({ error: "Database error", details: err.message });
      }

      // ✅ Always return valid JSON
      res.json(results.length > 0 ? results : []);
  });
});

app.get("/employer/:employerId/name", (req, res) => {
    const { employerId } = req.params;

    const query = "SELECT company_name AS name FROM employers WHERE id = ?"; // ✅ Corrected column name
    
    db.query(query, [employerId], (err, results) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ error: "Database error", details: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: "Employer not found" });
        }
        res.json({ name: results[0].name });
    });
});



/*So here the employer rate the employee about it work.
It will then store in the database and the will be fetch on employee page */
//recommendation
app.post('/add-recommendation', async (req, res) => {
  const { employer_id, employee_id, message, rating } = req.body;

  if (!employer_id || !employee_id || !message || !rating) {
      return res.status(400).json({ message: "All fields are required." });
  }

  try {
      const query = `INSERT INTO recommendations (employer_id, employee_id, message, rating) VALUES (?, ?, ?, ?)`;
      db.query(query, [employer_id, employee_id, message, rating], (err, result) => {
          if (err) {
              console.error("Database error:", err);
              return res.status(500).json({ message: "Error saving recommendation." });
          }
          res.status(201).json({ message: "Recommendation added successfully!" });
      });
  } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({ message: "Internal Server Error" });
  }
});

/*Here it will get the recommendation that is store in the database for the employee */
//get recommendations
app.get('/get-recommendations/:employee_id', (req, res) => {
  const { employee_id } = req.params;
  
  const query = `SELECT employers.company_name, recommendations.message, recommendations.rating, recommendations.created_at 
                 FROM recommendations 
                 JOIN employers ON recommendations.employer_id = employers.id 
                 WHERE recommendations.employee_id = ? 
                 ORDER BY recommendations.created_at DESC`;
  
  db.query(query, [employee_id], (err, results) => {
      if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Error fetching recommendations." });
      }
      res.json(results);
  });
});

/*Here it will search the employee based on the skills and certifications.
We are using the filtering and matching algorithm for it.
What it does is that it will filter the employee based on what the user have provied.
It will search the db and will give the result */
// Search for employees based on skills, certifications, and other filters
app.get('/search-employees', (req, res) => {
  const skills = req.query.skills || '';
  const certifications = req.query.certifications || '';
  const fullName = req.query.name || '';

  const sql = `
      SELECT e.id, e.full_name, 
             COALESCE(GROUP_CONCAT(DISTINCT s.skill_name SEPARATOR ', '), '') AS skills, 
             COALESCE(GROUP_CONCAT(DISTINCT c.certificate_name SEPARATOR ', '), '') AS certifications
      FROM employees e
      LEFT JOIN employee_skills es ON e.id = es.employee_id
      LEFT JOIN skills s ON es.skill_id = s.id
      LEFT JOIN certificates c ON e.id = c.employee_id  
      WHERE (s.skill_name LIKE ? OR ? = '') 
        AND (c.certificate_name LIKE ? OR ? = '') 
        AND (e.full_name LIKE ? OR ? = '')
      GROUP BY e.id
  `;

  db.query(sql, [
      `%${skills}%`, skills || '',
      `%${certifications}%`, certifications || '',
      `%${fullName}%`, fullName || ''
  ], (err, results) => {
      if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: 'Error searching for employees.', error: err.message });
      }
      res.json(results);
  });
});

/*Here the employee give brief intro about himself */
// Route to update About Me section
app.post('/update-about-me', (req, res) => {
  const { user_id, about_me_text } = req.body;

  // Validate input
  if (!user_id || !about_me_text) {
    return res.status(400).json({ error: 'User  ID and About Me text are required' });
  }

  // Check if the user already has an entry in the about_me table
  const checkQuery = 'SELECT * FROM about_me WHERE user_id = ?';
  db.query(checkQuery, [user_id], (err, results) => {
    if (err) {
      console.error('Error checking about_me entry:', err);
      return res.status(500).json({ error: 'Error checking about me entry' });
    }

    if (results.length > 0) {
      // Update existing entry
      const updateQuery = 'UPDATE about_me SET about_me_text = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?';
      db.query(updateQuery, [about_me_text, user_id], (err, updateResults) => {
        if (err) {
          console.error('Error updating about me section:', err);
          return res.status(500).json({ error: 'Error updating about me section' });
        }
        res.json({ message: 'About me section updated successfully' });
      });
    } else {
      // Insert new entry
      const insertQuery = 'INSERT INTO about_me (user_id, about_me_text) VALUES (?, ?)';
      db.query(insertQuery, [user_id, about_me_text], (err, insertResults) => {
        if (err) {
          console.error('Error inserting about me section:', err);
          return res.status(500).json({ error: 'Error inserting about me section' });
        }
        res.json({ message: 'About me section created successfully' });
      });
    }
  });
});

/*Here the employee add the skills */
// Create Skill (Ensures no duplicate skill entries)
app.post('/add-skill', (req, res) => {
  const { skill_name } = req.body;

  if (!skill_name) {
    return res.status(400).send({ message: 'Skill name is required.' });
  }

  const sql = 'INSERT INTO skills (skill_name) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)';
  db.query(sql, [skill_name], (err, result) => {
    if (err) {
      console.error('Error creating skill:', err);
      return res.status(500).send({ message: 'Error creating skill: ' + err.message });
    }
    res.send({ message: 'Skill created successfully.', id: result.insertId });
  });
});

// Get Skill ID by Name (Fetch skill ID if it exists)
app.get('/get-skill-id', (req, res) => {
  const skillName = req.query.skill_name;

  if (!skillName) {
    return res.status(400).json({ message: 'Skill name is required.' });
  }

  const sql = 'SELECT id FROM skills WHERE skill_name = ?';
  db.query(sql, [skillName], (err, result) => {
    if (err) {
      console.error("Error fetching skill ID:", err);
      return res.status(500).json({ message: 'Error fetching skill ID.' });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: 'Skill not found.' });
    }

    res.json({ id: result[0].id });
  });
});

// Add Multiple Skills and Link to Employee
app.post('/add-employee-skills', async (req, res) => {
  const { employee_id, skill_names } = req.body;

  if (!employee_id || !skill_names || !Array.isArray(skill_names) || skill_names.length === 0) {
    return res.status(400).json({ message: 'Employee ID and at least one skill name are required.' });
  }

  try {
    let skillIds = [];

    // Step 1: Fetch or Insert Skills
    for (const skill_name of skill_names) {
      let skillId;

      // Check if skill already exists
      const [existingSkill] = await new Promise((resolve, reject) => {
        db.query('SELECT id FROM skills WHERE skill_name = ?', [skill_name], (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      if (existingSkill) {
        skillId = existingSkill.id;
      } else {
        // Insert new skill and retrieve the ID
        const insertResult = await new Promise((resolve, reject) => {
          db.query('INSERT INTO skills (skill_name) VALUES (?)', [skill_name], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

        skillId = insertResult.insertId;
      }

      if (skillId) {
        skillIds.push(skillId);
      }
    }

    // Step 2: Link Employee to Skills
    const values = skillIds.map(skillId => [employee_id, skillId]);
    const employeeSkillQuery = 'INSERT IGNORE INTO employee_skills (employee_id, skill_id) VALUES ?';

    await new Promise((resolve, reject) => {
      db.query(employeeSkillQuery, [values], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.status(200).json({ message: 'Employee skills linked successfully.' });

  } catch (error) {
    console.error('Error processing skills:', error);
    res.status(500).json({ message: 'Error linking employee with skills.' });
  }
});


//Project
app.post('/add-project', (req, res) => {
  const { employee_id, title, description } = req.body; 

  if (!employee_id || !title || !description) {
    return res.status(400).json({ message: "All fields are required." });
  }

  const query = 'INSERT INTO projects (employee_id, title, description) VALUES (?, ?, ?)';
  db.query(query, [employee_id, title, description], (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ message: "Server Error" });
    }
    res.status(201).json({ message: "Project added successfully!" });  // ✅ Return JSON response
  });
});



//Certificate
// Certificate Upload API
app.post('/add-certificate', upload.single('certificate_file'), (req, res) => {
  console.log("Received request to add a certificate.");

  const { employee_id, certificate_name } = req.body;
  if (!req.file) {
      return res.status(400).send('Certificate file is required.');
  }

  // ✅ Fix: Store only the relative file path
  const certificate_file = `uploads/${req.file.filename}`;

  // Ensure all required fields are present
  if (!employee_id || !certificate_name || !certificate_file) {
      return res.status(400).send('All fields are required.');
  }

  // Check if the employee exists in the employees table
  const sql = 'SELECT COUNT(*) AS count FROM employees WHERE id = ?';
  db.query(sql, [employee_id], (err, results) => {
      if (err) {
          console.error(err);
          return res.status(500).send('Error checking employee existence.');
      }

      console.log('Employee Count:', results[0].count);
      if (results[0].count === 0) {
          return res.status(404).send('Employee not found.');
      }

      // ✅ Fix: Store correct relative path in database
      const insertSql = 'INSERT INTO certificates (employee_id, certificate_name, certificate_file) VALUES (?, ?, ?)';
      db.query(insertSql, [employee_id, certificate_name, certificate_file], (err, result) => {
          if (err) {
              console.error(err);
              return res.status(500).send('Error creating certificate.');
          }
          res.send('Certificate created successfully.');
      });
  });
});


// Authentication Middleware (Without Separate File)
function authenticateUser(req, res, next) {
  const token = req.header('Authorization'); // Expecting "Bearer <token>"

  if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
      const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
      req.user = decoded; // Store user data in request
      next(); // Proceed to next middleware or route
  } catch (error) {
      res.status(400).json({ success: false, message: 'Invalid token' });
  }
}

// Fetch certificates for logged-in user
app.get('/api/certificates', authenticateUser, (req, res) => {
  const employeeId = req.user?.id;  // Check if req.user is defined

  if (!employeeId) {
      return res.status(400).json({ success: false, message: "Invalid employee ID" });
  }

  const sql = 'SELECT id, certificate_name, certificate_file FROM certificates WHERE employee_id = ?';

  db.query(sql, [employeeId], (err, results) => {
      if (err) return res.status(500).json({ success: false, message: "Database error" });

      const certificates = results.map(cert => ({
          id: cert.id,
          certificate_name: cert.certificate_name,
          certificate_file: `/uploads/${cert.certificate_file}`
      }));

      res.json({ success: true, certificates });
  });
});


// Save contact information for a user
app.post('/update-contact', (req, res) => {
  try {
    const { user_id, contact_email, linkedin_profile } = req.body;

    // Validate input
    if (!user_id || !contact_email || !linkedin_profile) {
      return res.status(400).json({ error: 'User  ID, contact email, and LinkedIn profile are required' });
    }

    // Check if the user already has an entry in the contact_me table
    const checkQuery = 'SELECT * FROM contact_me WHERE user_id = ?';
    db.query(checkQuery, [user_id], (err, results) => {
      if (err) {
        console.error('Error checking contact_me entry:', err);
        return res.status(500).json({ error: 'Error checking contact info entry' });
      }

      if (results.length > 0) {
        // Update existing entry
        const updateQuery = 'UPDATE contact_me SET contact_email = ?, linkedin_profile = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?';
        db.query(updateQuery, [contact_email, linkedin_profile, user_id], (err, updateResults) => {
          if (err) {
            console.error('Error updating contact info:', err);
            return res.status(500).json({ error: 'Error updating contact info' });
          }
          res.json({ message: 'Contact info updated successfully.' });
        });
      } else {
        // Insert new entry
        const insertQuery = 'INSERT INTO contact_me (user_id, contact_email, linkedin_profile) VALUES (?, ?, ?)';
        db.query(insertQuery, [user_id, contact_email, linkedin_profile], (err, insertResults) => {
          if (err) {
            console.error('Error inserting contact info:', err);
            return res.status(500).json({ error: 'Error inserting contact info' });
          }
          res.json({ message: 'Contact info created successfully.' });
        });
      }
    });
  } catch (error) {
    console.error('Error updating contact info:', error);
    res.status(500).json({ error: 'Error updating contact info' });
  }
});

/*Here if we want to change anything in about me,project and contact me we can update the profile from here */
app.post('/update-profile', (req, res) => {
  const { user_id, about_me_text, project_title, project_description, contact_email, contact_linkedin } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  // ✅ Update About Me
  const updateAboutQuery = 'UPDATE about_me SET about_me_text = ? WHERE user_id = ?';
  db.query(updateAboutQuery, [about_me_text, user_id], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Error updating About Me" });
    }

    // ✅ Insert Project (Only if project details exist)
    if (project_title && project_description) {
      const insertProjectQuery = 'INSERT INTO projects (employee_id, title, description) VALUES (?, ?, ?)';
      db.query(insertProjectQuery, [user_id, project_title, project_description], (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Error adding project' });
        }
      });
    }

    // ✅ Update Contact Info
    const updateContactQuery = 'UPDATE contact_me SET contact_email = ?, linkedin_profile = ? WHERE user_id = ?';

    // Ensure `contact_linkedin` is always a string (not null)
    const safeContactLinkedIn = contact_linkedin || "";
    
    db.query(updateContactQuery, [contact_email, safeContactLinkedIn, user_id], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error updating contact info' });
      }
    
      // ✅ Send response after all queries complete
      res.json({ message: 'Profile updated successfully' });
    });
  });
});



// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
