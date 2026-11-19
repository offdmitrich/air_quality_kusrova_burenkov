const express = require('express');
const { Client } = require('pg');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();
app.use(express.static('public'));
// Встановлюємо EJS як шаблонний двигун
app.set('view engine', 'ejs');

// Middleware для обробки POST-запитів
app.use(bodyParser.urlencoded({ extended: false }));

// Налаштування сесій
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
}));

// Функція для створення клієнта PostgreSQL з обліковими даними сесії
function createDbClient(req) {
  return new Client({
    user: req.session.username,
    password: req.session.password,
    host: 'localhost',
    port: 5432,
    database: 'Station',
  });
}

// Відображаємо сторінку входу
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

// Обробка POST-запиту для входу
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const client = new Client({
    user: username,
    password: password,
    host: 'localhost',
    port: 5432,
    database: 'Station',
  });

  client.connect()
    .then(() => {
      req.session.username = username;
      req.session.password = password;
      res.redirect('/dashboard'); // Перенаправляємо на сторінку меню
    })
    .catch((err) => {
      console.error('Помилка підключення', err.stack);
      res.send('Невірні дані для входу');
    });
});

// Сторінка меню після входу
app.get('/dashboard', (req, res) => {
  if (!req.session.username || !req.session.password) {
    return res.redirect('/');
  }
  res.render('dashboard', { username: req.session.username });
});

// Сторінка для переходу до таблиць
app.get('/tables', (req, res) => {
  if (!req.session.username || !req.session.password) {
    return res.redirect('/');
  }
  res.render('tables'); // Ви можете відобразити список таблиць або інші потрібні дані
});

// Сторінка для звітів
app.get('/reports', (req, res) => {
  if (!req.session.username || !req.session.password) {
    return res.redirect('/');
  }
  // Тут можна додати код для відображення звітів
  res.render('reports'); // Приклад
});




// Сторінка категорій
app.get('/categories', async (req, res) => {
  if (!req.session.username || !req.session.password) {
    return res.redirect('/');
  }

  const client = createDbClient(req);

  try {
    await client.connect();
    const result = await client.query('SELECT * FROM category');
    res.render('index', { categories: result.rows });
  } catch (err) {
    console.error('Помилка при отриманні категорій', err.stack);
    res.status(500).send('Помилка сервера');
  } finally {
    await client.end();
  }
});

app.get('/measured_unit', async (req, res) => {
    if (!req.session.username || !req.session.password) {
      return res.redirect('/');
    }
  
    const client = createDbClient(req);
  
    try {
      await client.connect();
      const result = await client.query('select title, unit from measured_unit');
      res.render('measured_unit', { measured_unites: result.rows });
    } catch (err) {
      console.error('Error fetching categories', err.stack);
      res.status(500).send('Server Error');
    } finally {
      await client.end();
    }
  });

  app.get('/mqtt_server', async (req, res) => {
    if (!req.session.username || !req.session.password) {
      return res.redirect('/');
    }
  
    const client = createDbClient(req);
  
    try {
      await client.connect();
      const result = await client.query('select url, status from mqtt_server');
      res.render('mqtt_server', { mqtt_server: result.rows });
    } catch (err) {
      console.error('Error fetching categories', err.stack);
      res.status(500).send('Server Error');
    } finally {
      await client.end();
    }
  });
  app.get('/optimal_value', async (req, res) => {
    if (!req.session.username || !req.session.password) {
      return res.redirect('/');
    }
  
    const client = createDbClient(req);
  
    try {
      await client.connect();
      const result = await client.query(`
        SELECT 
          c.designation AS category_name, 
          mu.title AS unit_name, 
          ov.bottom_border, 
          ov.upper_border
        FROM 
          optimal_value ov
        JOIN 
          category c ON ov.id_category = c.id_category
        JOIN 
          measured_unit mu ON ov.id_measured_unit = mu.id_measured_unit;
      `);
      res.render('optimal_value', { optimal_value: result.rows });
    } catch (err) {
      console.error('Error fetching optimal values', err.stack);
      res.status(500).send('Server Error');
    } finally {
      await client.end();
    }
  });

  app.get('/station', async (req, res) => {
    if (!req.session.username || !req.session.password) {
        return res.redirect('/');
    }

    const client = createDbClient(req);

    try {
        await client.connect();
        const result = await client.query('SELECT city, name_, status, coordinates_::text AS coordinates FROM station');

        // Pass the data directly to the template
        res.render('station', { station: result.rows });
    } catch (err) {
        console.error('Error fetching stations', err.stack);
        res.status(500).send('Server Error');
    } finally {
        await client.end();
    }
});

app.get('/measurement', async (req, res) => {
    if (!req.session.username || !req.session.password) {
        return res.redirect('/');
    }

    const client = createDbClient(req);

    try {
        await client.connect();
        const result = await client.query(`
            SELECT 
    m.time_,
    m.value_,
    s.name_::text ,  -- Перетворення s.name_ в текст
    mu.title::text    -- Перетворення mu.title в текст
FROM 
    measurement m
JOIN 
    station s ON m.id_station = s.id_station
JOIN 
    measured_unit mu ON m.id_measured_unit = mu.id_measured_unit
LIMIT 30;  -- Обмеження на перші 100 записів
        `);

        // Pass the data directly to the template
        res.render('measurement', { measurement: result.rows });
    } catch (err) {
        console.error('Error fetching measurement data', err.stack);
        res.status(500).send('Server Error');
    } finally {
        await client.end();
    }
});



app.get('/report1', async (req, res) => {
    if (!req.session.username || !req.session.password) {
        return res.redirect('/');
    }
    // Отримання параметрів із запиту
    const { station, start_date, end_date } = req.query;
    // Створення клієнта бази даних із сесійною інформацією
    const client = createDbClient(req);
    try {
        await client.connect();
        // SQL-запит із параметрами для назви станції і діапазону дат
        const result = await client.query(
            `
            SELECT
                u.title AS parameter_name,
                MAX(CAST(REPLACE(m.value_, ',', '.') AS numeric)) AS max_value,
                MIN(CAST(REPLACE(m.value_, ',', '.') AS numeric)) AS min_value,
                ROUND(AVG(CAST(REPLACE(m.value_, ',', '.') AS numeric)), 2) AS avg_value
            FROM
                measurement m
            JOIN
                measured_unit u ON m.id_measured_unit = u.id_measured_unit
            JOIN
                station s ON m.id_station = s.id_station
            WHERE
                s.name_ = $1
                AND m.time_ BETWEEN $2 AND $3
            GROUP BY
                u.title
            ORDER BY
                parameter_name;
            `,
            [station, start_date, end_date]
        );

        // Передача результатів у шаблон для відображення
        res.render('report1', { stations: result.rows, stationName: station });
    } catch (err) {
        console.error('Error fetching data', err.stack);
        res.status(500).send('Server error');
    } finally {
        await client.end();
    }
});
app.get('/report1', (req, res) => {
    const stationName = req.query.station; // Отримання станції
    const startDate = req.query.start_date; // Отримання початкової дати
    const endDate = req.query.end_date; // Отримання кінцевої дати
    
    res.render('report', {
      stationName: stationName,
      startDate: startDate,
      endDate: endDate,
      stations: stationsData // Тут дані для таблиці
    });
  });

  app.get('/report2', async (req, res) => {
    if (!req.session.username || !req.session.password) {
        return res.redirect('/');
    }

    // Create a database client using session info
    const client = createDbClient(req);
    try {
        await client.connect();

        // Run the SQL query
        const query = `
            SELECT 
              s.Name_ AS "Station Name",
              MIN(m.Time_) AS "Connection Date",
              json_agg(DISTINCT mu.Title) AS "Measurements"
            FROM 
              Station s
            JOIN 
              Measurement m ON s.ID_Station = m.ID_Station
            JOIN 
              Measured_Unit mu ON m.ID_Measured_Unit = mu.ID_Measured_Unit
            WHERE 
              s.Status = 'enabled'
            GROUP BY
              s.Name_
            ORDER BY 
              s.Name_;
        `;
        const result = await client.query(query);

        // Pass the result data to the 'report2' template
        res.render('report2', { data: result.rows });
    } catch (err) {
        console.error('Error fetching report2 data:', err.stack);
        res.status(500).send("Error fetching report data");
    } finally {
        await client.end();
    }
});

app.get('/visualization', async (req, res) => {
  // Перевірка наявності сесії
  if (!req.session.username || !req.session.password) {
    return res.redirect('/');
  }

  // Отримуємо початкову та кінцеву дату з параметрів запиту
  const { startDate, endDate } = req.query;
  // Якщо дати не вказано, встановлюємо значення за замовчуванням (наприклад, поточний рік)
  const start = startDate || '2024-01-01'; 
  const end = endDate || '2024-12-31'; 

  // Створення підключення до бази даних
  const client = createDbClient(req);
  try {
    await client.connect();

    // Виконання SQL-запиту для отримання даних з урахуванням періоду часу
    const query = `
      SELECT
        s.City AS "City",
        MAX(CASE WHEN mu.Title = 'PM2.5' THEN CAST(REPLACE(m.Value_, ',', '.') AS DOUBLE PRECISION) END) AS "PM2.5",
        MAX(CASE WHEN mu.Title = 'PM10' THEN CAST(REPLACE(m.Value_, ',', '.') AS DOUBLE PRECISION) END) AS "PM10"
      FROM
        Station s
      JOIN
        Measurement m ON s.ID_Station = m.ID_Station
      JOIN
        Measured_Unit mu ON m.ID_Measured_Unit = mu.ID_Measured_Unit
      WHERE
        m.time_ BETWEEN $1 AND $2
      GROUP BY
        s.City;
    `;

    const result = await client.query(query, [start, end]); // Використовуємо параметри запиту для запобігання SQL-ін'єкціям

    // Логування отриманих даних
    console.log('Data sent to the template:', result.rows);

    // Передача отриманих даних в шаблон
    res.render('visualization', { data: result.rows });
  } catch (err) {
    console.error('Error fetching report data:', err.stack);
    res.status(500).send("Error fetching report data");
  } finally {
    await client.end();
  }
});



app.get('/visualization2', async (req, res) => {
  // Check for session presence
  if (!req.session.username || !req.session.password) {
    return res.redirect('/');
  }

  const stationName = req.query.stationName || ''; // Get the station name from query parameters (if any)
  const client = createDbClient(req);
  try {
    await client.connect();

    // SQL query to fetch data for the specified station name
    const query = `
        SELECT
        CASE
            WHEN c.Designation = 'Poor' THEN 'Harmful'
            WHEN c.Designation = 'Very Poor' THEN 'Very harmful'
        END::CHAR(255) AS Category,  -- Приведення типу до CHAR(255)
        COUNT(*)::DOUBLE PRECISION AS Count  -- Перетворення COUNT(*) в DOUBLE PRECISION
    FROM
        measurement m
    JOIN
        Optimal_Value ov ON m.ID_Measured_Unit = ov.ID_Measured_Unit
    JOIN
        Category c ON ov.ID_Category = c.ID_Category
    JOIN
        Station s ON m.ID_Station = s.ID_Station
    WHERE
        (c.Designation = 'Poor' OR c.Designation = 'Very Poor')
        AND CAST(REPLACE(m.Value_, ',', '.') AS DOUBLE PRECISION) BETWEEN ov.Bottom_Border AND ov.Upper_Border
        AND m.ID_Measured_Unit = '3'
        AND s.Name_ = $1  -- Use parameterized query for station name
    GROUP BY
        Category;
    `;
    const result = await client.query(query, [stationName]);

    // Render the visualization page with data and the station name
    res.render('visualization2', { data: result.rows, stationName: stationName });
  } catch (err) {
    console.error('Error fetching report data:', err.stack);
    res.status(500).send("Error fetching report data");
  } finally {
    await client.end();
  }
});



app.get('/visualization3', async (req, res) => {
  // Check for session presence
  if (!req.session.username || !req.session.password) {
    return res.redirect('/');
  }

  // Create a database client
  const client = createDbClient(req);
  try {
    await client.connect();

    // SQL query to fetch data for the fixed station name
    const query = `
       
SELECT 
    CASE
        WHEN CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) <= 25 THEN 'Excellent'
        WHEN CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) > 25 AND CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) <= 50 THEN 'Fine'
    END AS Category,
    COUNT(*) AS Count
FROM Measurement m
WHERE 
    m.ID_Measured_Unit = '13'
    AND CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) >= 0
    AND (
        (CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) <= 25)
        OR (CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) > 25 AND CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) <= 50)
    )
GROUP BY Category;

    `;

    const result = await client.query(query); // Execute query without passing station name as parameter

    // Render the visualization page with data
    res.render('visualization3', { data: result.rows });
  } catch (err) {
    console.error('Error fetching report data:', err.stack);
    res.status(500).send("Error fetching report data");
  } finally {
    await client.end();
  }
});

app.get('/visualization4', async (req, res) => {
  // Check for session presence
  if (!req.session.username || !req.session.password) {
    return res.redirect('/');
  }

  // Create a database client
  const client = createDbClient(req);
  try {
    await client.connect();

    // SQL query to fetch data for the fixed station name
    const query = `
       


    SELECT 
    'Excellent' AS Category,
    COUNT(*) AS Count
FROM 
    Measurement m
WHERE 
    m.ID_Measured_Unit = '12'
    AND CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) >= 0 
    AND CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) <= 2

UNION ALL

SELECT 
    'Good' AS Category,
    COUNT(*) AS Count
FROM 
    Measurement m
WHERE 
    m.ID_Measured_Unit = '12'
    AND CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) > 2 
    AND CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) <= 4

UNION ALL

SELECT 
    'Moderate' AS Category,
    COUNT(*) AS Count
FROM 
    Measurement m
WHERE 
    m.ID_Measured_Unit = '12'
    AND CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) > 4 
    AND CAST(REPLACE(m.Value_, ',', '.') AS DECIMAL) <= 6;


    `;

    const result = await client.query(query); // Execute query without passing station name as parameter

    // Render the visualization page with data
    res.render('visualization4', { data: result.rows });
  } catch (err) {
    console.error('Error fetching report data:', err.stack);
    res.status(500).send("Error fetching report data");
  } finally {
    await client.end();
  }
});





// Вихід з системи
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send('Помилка при виході');
    }
    res.redirect('/');
  });
});

// Запуск сервера
const port = 3000;
app.listen(port, () => {
  console.log(`Сервер працює на http://localhost:${port}`);
});
