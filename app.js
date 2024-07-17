const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images/'); // Adjust path as per your project structure
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});


const upload = multer({ storage: storage });

// MySQL connection setup
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'c237_cag_final'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Configure middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Configure express-session
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));

// Middleware to check if user is authenticated
app.use((req, res, next) => {
    res.locals.loggedIn = req.session.userId ? true : false;
    next();
});

// Routes

// Home route
app.get('/', (req, res) => {
    res.render('index', { loggedIn: req.session.userId });
});

// About route
app.get('/about', (req, res) => {
    res.render('about', { loggedIn: req.session.userId });
});

// Contact route
app.get('/contact', (req, res) => {
    res.render('contact', { loggedIn: req.session.userId });
});

// User registration form
app.get('/register', (req, res) => {
    res.render('register', { loggedIn: req.session.userId });
});

// Handle user registration
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
    connection.query(sql, [username, email, hashedPassword], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error registering user');
        }
        res.redirect('/login');
    });
});

// User login form
app.get('/login', (req, res) => {
    res.render('login', { loggedIn: req.session.userId });
});

// Handle user login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const sql = 'SELECT * FROM users WHERE email = ?';
    connection.query(sql, [email], async (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error logging in user');
        }
        if (results.length > 0) {
            const user = results[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                req.session.userId = user.id;
                res.redirect('/');
            } else {
                res.status(401).send('Invalid email or password');
            }
        } else {
            res.status(401).send('Invalid email or password');
        }
    });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Browse Stations route
app.get('/stations', (req, res) => {
    const sql = 'SELECT * FROM station';
    connection.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving stations');
        }
        res.render('stations', { stations: results, loggedIn: req.session.userId });
    });
});

// Station Details route
app.get('/stations/:id', (req, res) => {
    const stationId = req.params.id;
    const sql = 'SELECT * FROM station WHERE id = ?';
    connection.query(sql, [stationId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving station details');
        }
        if (results.length > 0) {
            res.render('stationDetails', { station: results[0], loggedIn: req.session.userId });
        } else {
            res.status(404).send('Station not found');
        }
    });
});

// Favourites route
app.get('/favourites', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    const sql = 'SELECT * FROM station INNER JOIN favourites ON station.id = favourites.stationId WHERE favourites.userId = ?';
    connection.query(sql,[req.session.userId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving stations');
        }
        console.log(results)
        res.render('favourites', { favouriteStations: results, loggedIn: req.session.userId });
    });
});

// Add Station Form route
app.get('/addStation', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.render('addStation', { loggedIn: req.session.userId });
});

// Add Station POST route
app.post('/addStation', upload.single('image'), (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    const { name, language, description, streamUrl } = req.body;
    const image = '/images/' + req.file.originalname; // images are stored in '/public/images'

    const sql = 'INSERT INTO station (name, language, description, streamUrl, image) VALUES (?, ?, ?, ?, ?)';
    connection.query(sql, [name, language, description, streamUrl, image], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error adding station');
        }
        res.redirect('/favourites'); // Redirect to favourites page after adding station
    });
});

app.post('/addFavourites', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    const { stationId } = req.body;
    const userId = req.session.userId
    console.log(userId)
    const sql = 'INSERT INTO favourites (userId, stationId) VALUES (?, ?)';
    connection.query(sql, [userId,stationId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving favourite stations');
        }
        res.render('favourites');
    });
});


// Add Station Edit Form route
app.get('/editStation/:id', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    const stationId = req.params.id;
    const sql = 'SELECT * FROM station WHERE id = ?';
    connection.query(sql, [stationId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving station');
        }
        if (results.length === 0) {
            return res.status(404).send('Station not found');
        }
        const station = results[0];
        res.render('editStation', { station, loggedIn: req.session.userId });
    });
});

// Handle Station Edit POST route
app.post('/editStation/:id', upload.single('image'), (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    const stationId = req.params.id;
    const { name, language, description, streamUrl } = req.body;
    let image = req.body.currentImage; // Use existing image if no new one is uploaded

    if (req.file) {
        image = '/images/' + req.file.filename;
    }

    const sql = 'UPDATE station SET name = ?, language = ?, description = ?, streamUrl = ?, image = ? WHERE id = ?';
    connection.query(sql, [name, language, description, streamUrl, image, stationId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error updating station');
        }
        res.redirect('/stations/' + stationId);
    });
});

// Handle Station Delete POST route
app.post('/deleteStation/:id', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    const stationId = req.params.id;
    const sql = 'DELETE FROM station WHERE id = ?';
    connection.query(sql, [stationId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error deleting station');
        }
        res.redirect('/favourites');
    });
});

// Add Favourite POST route
app.post('/addStation', (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // A multer error occurred
            console.error('Multer Error:', err);
            return res.status(500).send('Error uploading file');
        } else if (err) {
            // An unknown error occurred
            console.error('Unknown Error:', err);
            return res.status(500).send('Something went wrong');
        }
        
        // No error occurred, continue processing the form submission
        const { name, language, description, streamUrl } = req.body;
        const image = '/images/' + req.file.filename;

        const sql = 'INSERT INTO station (name, language, description, streamUrl, image) VALUES (?, ?, ?, ?, ?)';
        connection.query(sql, [name, language, description, streamUrl, image], (error, results) => {
            if (error) {
                console.error('Database query error:', error.message);
                return res.status(500).send('Error adding station');
            }
            res.redirect('/stations'); // Redirect to stations list after adding station
        });
    });
});

// Search route
app.get('/search', (req, res) => {
    const query = req.query.query;
    const sql = 'SELECT * FROM station WHERE name LIKE ? OR description LIKE ? OR language LIKE ?';
    connection.query(sql, [`%${query}%`, `%${query}%`, `%${query}%`], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving search results');
        }
        res.render('search', { query, searchResults: results, loggedIn: req.session.userId });
    });
});

// Add Station POST route
app.post('/addStation', upload.single('image'), (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    const { name, language, description, streamUrl } = req.body;
    let image = '';

    if (req.file) {
        image = '/images/' + req.file.filename;
    }

    const sql = 'INSERT INTO station (name, language, description, streamUrl, image) VALUES (?, ?, ?, ?, ?)';
    connection.query(sql, [name, language, description, streamUrl, image], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error adding station');
        }
        res.redirect('/favourites'); // Redirect to favourites page after adding station
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
