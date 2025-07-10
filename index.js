// Load environment variables
require('dotenv').config();

const express = require('express')
const fs = require('fs')
const app = express();
const https = require('https');
const request = require('request')
const crypto = require('crypto')
const lodash = require('lodash');
const format = require('pg-format');
const admin = require('firebase-admin');
const pg = require('pg');
const cors = require("cors");
const schedule = require('node-schedule');
const axios = require('axios');
const bodyParser = require('body-parser');
var serviceAccount = require("./serviceAccountKey.json");

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

console.log(`Running in ${process.env.NODE_ENV} mode`);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://nanog-e3f80-default-rtdb.firebaseio.com"
});


const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
};



app.use(cors(corsOptions));
app.use(express.static(__dirname + '/public'));
// app.use(express.json({ limit: '100mb' }));
// app.use(express.urlencoded({ limit: '100mb', extended: true }));
const requestLimit = process.env.REQUEST_LIMIT || '1024mb';
app.use(express.json({ limit: requestLimit }));
app.use(express.urlencoded({ limit: requestLimit, extended: true }));

//qwer1234
//root

const config = {
  user: process.env.DB_USER || 'postgres',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
  port: parseInt(process.env.DB_PORT) || 5432,
  host: process.env.DB_HOST || 'localhost',
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 100
};


const pool = new pg.Pool(config)

pg.types.setTypeParser(1700, function (val) {
  return parseFloat(val);
});

pg.types.setTypeParser(20, function (val) {
  return parseFloat(val);
});

pg.types.setTypeParser(701, function (val) {
  return parseFloat(val);
});

// Check if SSL certificates exist for HTTPS, otherwise use HTTP for local development
let server;
const httpsEnabled = process.env.HTTPS_ENABLED === 'true';

if (httpsEnabled && isProduction) {
  try {
    server = require('https').createServer({
      key: fs.readFileSync(process.env.SSL_KEY_PATH || 'C:/Certbot/live/api.nanogapp.com/privkey.pem'),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH || 'C:/Certbot/live/api.nanogapp.com/cert.pem'),
      ca: [
        fs.readFileSync(process.env.SSL_CHAIN_PATH || 'C:/Certbot/live/api.nanogapp.com/chain.pem'),
        fs.readFileSync(process.env.SSL_FULLCHAIN_PATH || 'C:/Certbot/live/api.nanogapp.com/fullchain.pem'),
      ]
    }, app);
    console.log('HTTPS server created with SSL certificates');
  } catch (error) {
    console.log('SSL certificates not found, falling back to HTTP');
    server = require('http').createServer(app);
  }
} else {
  console.log('Using HTTP server for development');
  server = require('http').createServer(app);
}

app.get('/', (req, res) => {
  // console.log('spaming');


  return res.status(200).send({ success: 'success' })
})


const io = require('socket.io')(server, {
  transports: ['websocket'],
  cors: {
    origin: '*',
  }
});

io.on('connection', (socket) => {
  console.log('called');
  // on means every time client emit joinRoom, will run this function, room means data sent from client side
  socket.on('joinRoom', function (room) {
    console.log(room)
    // join means this socket will join this room and receive any message sent to this room
    socket.join(room);
  });

  socket.on('callUpdate', (name) => {
    console.log('callUpdate');
    socket.username = name;
    io.emit('usersActivity', {
      user: socket.username,
      event: 'approved'
    });
  });

  socket.on('callSchedule', (name) => {
    console.log('callSchedule');
    socket.username = name;
    io.emit('a', {
      user: socket.username,
      event: 'approved'
    });
  });


  socket.on('disconnect', function () {
    console.log('disconnect');
    // disconnect this socket
    socket.disconnect()
  })


})

app.post('/fcmAny', (req, res) => {

  var title = req.body.title;
  var body = req.body.body;
  var path = req.body.path
  var topic = req.body.topic

  var message = {
    data: {
      path: path,
      message: body,
      title: title,
    },
    notification: {
      title: title,
      body: body,
    },

    android: {
      notification: {
        title: title,
        body: body,
        click_action: "FCM_PLUGIN_ACTIVITY",
      }
    },

    topic: topic
  };

  // Send a message to all devices subscribed to topic 'all'

  return admin.messaging().send(message)
    .then((response) => {
      // Response is a message ID string.
      console.log('Successfully sent message:', response);
      return res.status(200).send({ message: "Hello from admin! This is user!" });
    })
    .catch((error) => {
      console.log('Error sending message:', error);
      return res.status(500).send({ error: "Error" })
    });
})

const { uploadFile, uploadPDF, uploadPDFSE, uploadSOF, uploadPDFReceipt, uploadPDFReceipt2, uploadPDFSE2, uploadsignimage, uploadbentopdf, uploadSER, downloadImg } = require('./s3.js');
const { result, isNull } = require('lodash');
const { release } = require('os');
const { log } = require('console');

app.post('/upload', async (req, res) => {
  console.log('upload');
  let imageData = req.body.image
  let folder = req.body.folder
  let userid = req.body.userid
  const result = await uploadsignimage(imageData, folder, userid)

  if (result) {
    res.status(200).send({ imageURL: result ? result.Location : "" })
  } else {
    res.status(400).send({ message: "Wrong Base 64 Format/ Wrong File" })
  }
})

app.post('/downloadfroms3', async (req, res) => {
  console.log('downloadfroms3');
  let imageData = req.body.img
  const result = await downloadImg(imageData)
  if (result) {
    res.status(200).send({ imageURL: result ? result : "" })
  } else {
    res.status(400).send({ message: "Wrong Base 64 Format/ Wrong File" })
  }
})



app.post('/uploadFilePDF', async (req, res) => {
  console.log('uploadFilePDF');
  let base64 = req.body.base64

  const result = await uploadPDF(base64)
  if (result) {
    res.status(200).send({ imageURL: result ? result.Location : "" })
  } else {
    console.log('error');
    res.status(400).send({ message: "Wrong Base 64 Format/ Wrong File" })
  }
})

app.post('/uploadFilePdfDoc', async (req, res) => {
  console.log('Received base64 upload');
  let base64 = req.body.base64;

  // Ensure base64 is valid
  if (!base64) {
    return res.status(400).send({ message: 'No base64 data provided' });
  }

  const mimeTypeMatch = base64.match(/^data:(application\/(pdf|vnd.openxmlformats-officedocument.wordprocessingml.document));base64,/);
  if (!mimeTypeMatch) {
    return res.status(400).send({ message: 'Unsupported file type' });
  }

  const mimeType = mimeTypeMatch[1];
  const extension = mimeType === 'application/pdf' ? '.pdf' : '.docx';

  const result = await uploadFile(base64, mimeType, extension);

  if (result) {
    res.status(200).send({ fileURL: result.Location });
  } else {
    console.log('Error uploading file');
    res.status(400).send({ message: 'File upload failed' });
  }
});

app.post('/uploadQFPDF', async (req, res) => {
  console.log('uploadQFPDF');
  let base64 = req.body.base64
  let leadid = req.body.leadid
  let salesid = req.body.salesid
  let no = req.body.no

  const result = await uploadPDFSE(base64, leadid, salesid, no)
  if (result) {
    res.status(200).send({ imageURL: result ? result.Location : "" })
  } else {
    console.log('error');
    res.status(400).send({ message: "Wrong Base 64 Format/ Wrong File" })
  }
})

//bento
app.post('/uploadbento', async (req, res) => {
  console.log('uploadbento');
  let base64 = req.body.base64
  let no = req.body.no

  const result = await uploadbentopdf(base64, no)
  if (result) {
    res.status(200).send({ imageURL: result ? result.Location : "" })
  } else {
    console.log('error');
    res.status(400).send({ message: "Wrong Base 64 Format/ Wrong File" })
  }
})

app.post('/uploadFilePDF2', async (req, res) => {
  console.log('uploadFilePDF2');
  let base64 = req.body.base64
  let leadid = req.body.leadid
  let salesid = req.body.salesid
  let no = req.body.no

  const result = await uploadPDFSE2(base64)
  if (result) {
    res.status(200).send({ imageURL: result ? result.Location : "" })
  } else {
    console.log('error');
    res.status(400).send({ message: "Wrong Base 64 Format/ Wrong File" })
  }
})

app.post('/uploadReceiptPDF', async (req, res) => {
  console.log('uploadReceiptPDF');
  let base64 = req.body.base64

  const result = await uploadPDFReceipt(base64)
  if (result) {
    res.status(200).send({ imageURL: result ? result.Location : "" })
  } else {
    console.log('error');
    res.status(400).send({ message: "Wrong Base 64 Format/ Wrong File" })
  }
})

app.post('/uploadReceiptPDF2', async (req, res) => {
  console.log('uploadReceiptPDF2');
  let base64 = req.body.base64
  let name = req.body.name

  const result = await uploadPDFReceipt2(base64, name)
  if (result) {
    res.status(200).send({ imageURL: result ? result.Location : "" })
  } else {
    console.log('error');
    res.status(400).send({ message: "Wrong Base 64 Format/ Wrong File" })
  }
})

app.post('/uploadSOFFilePDF', async (req, res) => {
  console.log('uploadSOFFilePDF');
  let base64 = req.body.base64
  let pdfname = req.body.pdfname

  const result = await uploadSOF(base64, pdfname)
  if (result) {
    res.status(200).send({ imageURL: result ? result.Location : "" })
  } else {
    console.log('error');
    res.status(400).send({ message: "Wrong Base 64 Format/ Wrong File" })
  }
})

app.post('/uploadServiceFilePDF', async (req, res) => {
  console.log('uploadServiceFilePDF');
  let base64 = req.body.base64
  let pdfname = req.body.pdfname

  const result = await uploadSER(base64, pdfname)
  if (result) {
    res.status(200).send({ imageURL: result ? result.Location : "" })
  } else {
    console.log('error');
    res.status(400).send({ message: "Wrong Base 64 Format/ Wrong File" })
  }
})



app.get('/testt', (req, res) => {
  console.log('testt');

  return res.status(200).send({ success: true })

})



// app.listen(80, function () {

//   console.log('server start')

// })

//NANO website

app.post('/createUser', async (req, res) => {

  admin.auth().createUser({ email: req.body.email, password: req.body.password }).then(a => {
    req.body.uid = a.uid;

    console.log('createUser')

    pool.query(`INSERT INTO nano_user(user_name, user_phone_no, user_email,user_state,user_address,user_role, emp_id, login_id, password, active, status, created_at, profile_image, uid, colour,branch, is_leader) 
    VALUES($1,$2,$3,$4,$5,$6,
      CASE WHEN 'Sales Coordinator' = $6::varchar THEN 'SC' || LPAD(nextval('salescoord'):: varchar, 5, '0')
      WHEN 'Sales Executive' = $6::varchar   THEN 'SE' || LPAD(nextval('salesexec'):: varchar, 5, '0')
      WHEN 'System Admin' = $6::varchar   THEN 'SA' || LPAD(nextval('systemadmin'):: varchar, 5, '0')
      WHEN 'Finance' = $6::varchar   THEN 'FI' || LPAD(nextval('finance'):: varchar, 5, '0')
      WHEN 'Account' = $6::varchar   THEN 'AC' || LPAD(nextval('account'):: varchar, 5, '0')
       ELSE 'PC' || LPAD(nextval('projectcoordinator'):: varchar, 5, '0') end, 
      $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`, [req.body.name, req.body.phone, req.body.email, req.body.state,
    req.body.address, req.body.role, req.body.login_id, req.body.password, req.body.active,
    req.body.status, req.body.created_at, req.body.profile_image, req.body.uid, req.body.colour, req.body.branch, req.body.is_leader]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

    // CASE WHEN 'Sales Coordinator' = first_name THEN 'SA' || LPAD(nextval('salescoord'):: varchar, 4, '0')
    //    WHEN 'Sales Person' = first_name  THEN 'SE' || LPAD(nextval('salesexec'):: varchar, 4, '0')
    //     ELSE 'PA' || LPAD(nextval('projectcoordinator'):: varchar, 4, '0') end,

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error })
  })

})

//reset password


//get project manager user



app.post('/getUserDetail', async (req, res) => {
  console.log('getUserDetail')

  pool.query(`SELECT * FROM nano_user WHERE uid = $1`, [req.body.uid]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/getSpecificUser', async (req, res) => {
  console.log('getSpecificUser');
  pool.query(`SELECT * FROM nano_user where user_role = $1`,
    [req.body.user_role], function (err, result) {

      if (err) {
        console.log(err);
        return res.status(800).send({ err: err })
      } else {
        return res.status(200).send({ data: result.rows })
      }
    })
})

app.get('/getUserList', async (req, res) => {
  console.log('getUserList')

  pool.query(`SELECT * FROM nano_user where status = true`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.get('/getUserListPanel', async (req, res) => {
  console.log('getUserListPanel')

  pool.query(`SELECT * FROM nano_user`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/updateUserDetails', (req, res) => {
  console.log('updateUserDetails');

  pool.query(`UPDATE nano_user SET (user_name, user_phone_no, user_address, profile_image, user_state, user_role, status,colour, branch, login_id, is_leader) 
  = ($1, $2, $3, $4, $5, $6, $7, $8, $9, $11, $12) WHERE uid = $10 `,
    [req.body.name, req.body.phone, req.body.address, req.body.profile_image, req.body.state, req.body.role, req.body.status,
    req.body.colour, req.body.branch, req.body.uid, req.body.login_id, req.body.is_leader]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

//NANO DASHBOARD

//Manage Sub company
app.post('/createCompany', async (req, res) => {

  admin.auth().createUser({ email: req.body.email, password: req.body.password }).then(a => {
    req.body.uid = a.uid;
    req.body.created_at = new Date().getTime()
    console.log('createCompany')

    pool.query(`INSERT INTO sub_company(name, email, state, address, login_id, password, status, uid, created_at, name_display, type) 
    VALUES($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10)`, [req.body.name, req.body.email, req.body.state,
    req.body.address, req.body.login_id, req.body.password, req.body.uid, req.body.created_at, req.body.name_display, req.body.type
    ]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

    // CASE WHEN 'Sales Coordinator' = first_name THEN 'SA' || LPAD(nextval('salescoord'):: varchar, 4, '0')
    //    WHEN 'Sales Person' = first_name  THEN 'SE' || LPAD(nextval('salesexec'):: varchar, 4, '0')
    //     ELSE 'PA' || LPAD(nextval('projectcoordinator'):: varchar, 4, '0') end,

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error })
  })

})

app.get('/getAllSubCompany', (req, res) => {
  console.log('getAllSubCompany');

  pool.query(`SELECT * FROM sub_company`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getSpecificCompanyDetail', async (req, res) => {
  console.log('getSpecificCompanyDetail')

  pool.query(`SELECT * FROM sub_company WHERE id = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/updateCompany', async (req, res) => {
  console.log('updateCompany')

  pool.query(`UPDATE sub_company SET (name_display, state, address, login_id, status) = ($1, $2, $3, $4, $5) WHERE id = $6`,
    [req.body.name_display, req.body.state, req.body.address, req.body.login_id, req.body.status, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})




//Get Channel Numbers
app.get('/getDashboardChannel2', (req, res) => {
  console.log('getDashboardChannel2');
  // (SELECT SUM(t.calc) FROM (SELECT (SELECT COUNT(*) FROM nano_leads l WHERE l.channel_id = c.name OR l.channel_id != c.name ) 
  // AS calc FROM nano_channel c WHERE c.category = 'other' ) AS t ) AS channel_other

  // (SELECT COUNT(t.calc) FROM (SELECT (SELECT COUNT(*) FROM nano_leads l WHERE l.channel_id IS NOT NULL OR
  // (SELECT COUNT(name) FROM nano_channel WHERE name = l.channel_id) = 0) 
  // AS calc FROM nano_channel c WHERE c.category = 'other' ) AS t ) AS channel_other
  pool.query(`  SELECT 
  (SELECT COUNT(*) FROM nano_leads l LEFT JOIN nano_channel c ON l.channel_id = c.name WHERE 
  l.channel_id IS NOT NULL AND ((SELECT COUNT(name) FROM nano_channel WHERE name = l.channel_id) = 0 OR c.category = 'other')) AS channel_other,
  
  (SELECT COUNT(id) FROM nano_leads WHERE channel_id IS NULL) AS channel_null,
  
  (SELECT SUM(t.calc) FROM (SELECT (SELECT COUNT(*) FROM nano_leads l WHERE l.channel_id = c.name) 
  AS calc FROM nano_channel c WHERE c.category = 'whatsapp') AS t ) AS channel_whatsapp,
  
  (SELECT SUM(t.calc) FROM (SELECT (SELECT COUNT(*) FROM nano_leads l WHERE l.channel_id = c.name) 
  AS calc FROM nano_channel c WHERE c.category = 'instagram') AS t ) AS channel_instagram,
  
  (SELECT SUM(t.calc) FROM (SELECT (SELECT COUNT(*) FROM nano_leads l WHERE l.channel_id = c.name) 
  AS calc FROM nano_channel c WHERE c.category = 'facebook') AS t ) AS channel_facebook,

  (SELECT SUM(t.calc) FROM (SELECT (SELECT COUNT(*) FROM nano_leads l WHERE l.channel_id = c.name) 
  AS calc FROM nano_channel c WHERE c.category = 'radio') AS t ) AS channel_radio,
  
  (SELECT SUM(t.calc) FROM (SELECT (SELECT COUNT(*) FROM nano_leads l WHERE l.channel_id = c.name) 
  AS calc FROM nano_channel c WHERE c.category = 'call in') AS t ) AS channel_callin FROM nano_leads LIMIT 1`).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.get('/getDashboardChannel', (req, res) => {
  console.log('getDashboardChannel');
  pool.query(` SELECT 
  (SELECT COUNT(*) from nano_leads where LOWER(channel_id) NOT LIKE '%instagram%' AND LOWER(channel_id) NOT LIKE '%ig%'
  AND LOWER(channel_id) != 'whatsapp' AND LOWER(channel_id) != 'whatsapp (web)' AND LOWER(channel_id) NOT LIKE '%fb%' 
  AND LOWER(channel_id) NOT LIKE '%facebook%' AND LOWER(channel_id) NOT LIKE '%radio%' AND LOWER(channel_id) NOT LIKE '%call%'
  OR channel_id IS NULL OR channel_id = '') AS channel_other,
  
  (0) AS channel_null,
  
  (SELECT COUNT(*) from nano_leads where LOWER(channel_id) = 'whatsapp' OR LOWER(channel_id) = 'whatsapp (web)') AS channel_whatsapp,
  
  (SELECT COUNT(*) from nano_leads where LOWER(channel_id) LIKE '%instagram%' OR LOWER(channel_id) LIKE '%ig%') AS channel_instagram,
  
  (SELECT COUNT(*) from nano_leads where LOWER(channel_id) LIKE '%fb%' OR LOWER(channel_id) LIKE '%facebook%') AS channel_facebook,

  (SELECT COUNT(*) from nano_leads where LOWER(channel_id) LIKE '%radio%') AS channel_radio,
  
  (SELECT COUNT(*) from nano_leads where LOWER(channel_id) LIKE '%call%') AS channel_callin 
  FROM nano_leads LIMIT 1
  `).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})



// SELECT DISTINCT assigned_to4, COUNT(assigned_to4) AS occurence  FROM nano_appointment na 
// LEFT JOIN nano_user nu ON na.assigned_to4 = nu.user_id::text GROUP BY assigned_to4 ORDER BY occurence ASC LIMIT 1 
app.post('/createLead', async (req, res) => {
  console.log('createLead')
  req.body.created = new Date().getTime()
  !req.body.sales_exec ? req.body.sales_exec = JSON.stringify([]) : req.body.sales_exec
  // req.body.warranty == undefined || req.body.warranty == '' || req.body.warranty == null || req.body.warranty == false
  if (!req.body.warranty) {
    pool.query(`INSERT INTO nano_leads(created_date, customer_name,
      customer_email, customer_phone, customer_city, customer_state, address, company_address,
      saleexec_note, remark, ads_id, channel_id, sales_admin, services, issues, lattitude, longtitude, sales_coordinator, label_m, label_s, remark_json, status, 
      sc_photo, created_by, race, gender, customer_title, verified, customer_unit, sc_video, sc_document) 
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, $16, $17, $18, $19, $20, $21, true, $22, $23, $24, $25, $26, $27, $28, $29, $30) RETURNING id`,
      [req.body.created, req.body.name, req.body.email, req.body.phone,
      req.body.city, req.body.state, req.body.address, req.body.comp_address, req.body.sales_note,
      req.body.remark, req.body.ads, req.body.channel, req.body.admin, req.body.services, req.body.issues, req.body.lattitude,
      req.body.longitude, req.body.coordinator, req.body.label_m, req.body.label_s,
      req.body.remark_json, req.body.sc_photo, req.body.created_by, req.body.race, req.body.gender, req.body.title, req.body.verified, req.body.customer_unit, req.body.sc_video, req.body.sc_document]).then((result) => {
        lead_id = result.rows[0]['id']

        pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`, [req.body.created_by]).then((result) => {
          let by = (result.rows.length > 0 ? result.rows[0]['user_name'] : null)
          pool.query(`INSERT INTO nano_activity_log(lead_id, activity_time, activity_by, remark , activity_type) VALUES ($1, $2, $3, $4, $5)`,
            [lead_id, req.body.created, req.body.created_by, 'Lead created by ' + (result.rows.length > 0 ? result.rows[0]['user_name'] : null), 'Lead']).then((result) => {

              pool.query(`INSERT INTO nano_appointment(lead_id, created_time, appointment_status, assigned_to4 ) VALUES($1, $2, $3, $4)`, [lead_id, req.body.created, true, req.body.sales_exec]).then((result) => {
                let from = new Date().setHours(0, 0, 0, 0)
                let to = new Date().setHours(23, 59, 59, 59)
                if (req.body.coordinator == null) {
                  pool.query(`
                 WITH coord AS(
                  SELECT uid FROM nano_user WHERE user_role = 'Sales Coordinator' AND uid != 'jtCqpxB5FpRKDG0bvXWgEXLxNWG3' AND status = true
                  ),
                  counted AS (
                  SELECT DISTINCT co.uid, coalesce(COUNT(nl.sales_coordinator),0) AS counter FROM coord co
                  LEFT JOIN nano_leads nl ON co.uid = nl.sales_coordinator
                  WHERE nl.created_date >= $2 AND nl.created_date <= $3
                  GROUP BY co.uid  ORDER BY co.uid 
                  ),
                  ordered AS(
                   SELECT co.uid, counter FROM coord co LEFT JOIN counted ct ON ct.uid = co.uid ORDER BY COALESCE(counter, -1) LIMIT 1
                  )               
                  UPDATE nano_leads SET sales_coordinator = (SELECT uid FROM ordered) WHERE id = $1 RETURNING sales_coordinator`, [lead_id, from, to]).then((result) => {

                    let to_id = result.rows[0]['sales_coordinator']

                    pool.query(`
                    INSERT INTO nano_sc_notification (sn_created_date, lead_id, sn_remark, uid, to_id) 
                    VALUES ($1, $2, $3, $4, $5)`, [req.body.created, lead_id, 'New Lead has been Created by ' + by, req.body.created_by, to_id]).then((result) => {

                      return res.status(200).send({ data: lead_id, success: true })
                    }).catch((error) => {
                      console.log(error)
                      return res.status(800).send({ success: false })
                    })

                  }).catch((error) => {
                    console.log(error)
                    return res.status(800).send({ success: false })
                  })
                } else {
                  return res.status(200).send({ success: true })
                }


              }).catch((error) => {
                console.log(error)
                return res.status(800).send({ success: false })
              })


            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })



      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
  } else {
    pool.query(`INSERT INTO nano_leads(created_date, customer_name,
      customer_email, customer_phone, customer_city, customer_state, address, company_address,
      saleexec_note, remark, ads_id, channel_id, sales_admin, services, issues, lattitude, longtitude,
       sales_coordinator, label_m, label_s, remark_json, status, sc_photo, created_by, race, gender, customer_title,verified, customer_unit, sc_video, sc_document) 
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, $16, $17, $18, $19, $20, $21, true, $22, $23, $24, $25, $26, $27, $28, $29, $30) RETURNING id`,
      [req.body.created, req.body.name, req.body.email, req.body.phone,
      req.body.city, req.body.state, req.body.address, req.body.comp_address, req.body.sales_note,
      req.body.remark, req.body.ads, req.body.channel, req.body.admin, req.body.services, req.body.issues, req.body.lattitude,
      req.body.longitude, req.body.coordinator, req.body.label_m, req.body.label_s,
      req.body.remark_json, req.body.sc_photo, req.body.created_by, req.body.race, req.body.gender, req.body.title, req.body.verified, req.body.customer_unit, req.body.sc_video, req.body.sc_document]).then((result) => {
        console.log(req.body.created_by);
        lead_id = result.rows[0]['id']
        pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`, [req.body.created_by]).then((result) => {

          pool.query(`INSERT INTO nano_activity_log(lead_id, activity_time, activity_by, remark , activity_type) VALUES ($1, $2, $3, $4, $5)`,
            [req.body.old_lead, req.body.created, req.body.created_by, 'Warranty Form Submitted by Client', 'Warranty']).then((result) => {

              pool.query(`INSERT INTO nano_activity_log(lead_id, activity_time, activity_by, remark , activity_type) VALUES ($1, $2, $3, $4, $5)`,
                [lead_id, req.body.created, req.body.created_by, 'Warranty Lead Created', 'Lead']).then((result) => {
                  pool.query(`INSERT INTO nano_appointment(lead_id, created_time, assigned_to4) VALUES($1, $2, $3)`, [lead_id, req.body.created, req.body.sales_exec]).then((result) => {

                    pool.query(`INSERT INTO nano_warranty(remark, created_date, linked_lead, faulty_area) VALUES($1, $2, $3, $4) RETURNING id
                   `, [req.body.warranty_remark, req.body.created, req.body.old_lead, req.body.faulty_area]).then((result) => {
                      warranty_id = result.rows[0]['id']
                      let from = new Date().setHours(0, 0, 0, 0)
                      let to = new Date().setHours(23, 59, 59, 59)
                      if (req.body.sales_coordinator == null) {
                        pool.query(`
                   WITH coord AS(
                    SELECT uid FROM nano_user WHERE user_role = 'Sales Coordinator' AND uid != 'jtCqpxB5FpRKDG0bvXWgEXLxNWG3' AND status = true
                    ),            
                    counted AS (
                    SELECT DISTINCT co.uid, coalesce(COUNT(nl.sales_coordinator),0) AS counter FROM coord co
                    LEFT JOIN nano_leads nl ON co.uid = nl.sales_coordinator
                    WHERE nl.created_date >= $2 AND nl.created_date <= $3
                    GROUP BY co.uid  ORDER BY co.uid 
                    ),
                    ordered AS(
                     SELECT co.uid, counter FROM coord co LEFT JOIN counted ct ON ct.uid = co.uid ORDER BY COALESCE(counter, -1) LIMIT 1
                    )               
                    UPDATE nano_leads SET sales_coordinator = (SELECT uid FROM ordered), warranty_id = $4 WHERE id = $1`, [lead_id, from, to, warranty_id]).then((result) => {

                          // return res.status(200).send({ data: lead_id, success: true })
                          let to_id = result.rows[0]['sales_coordinator']

                          pool.query(`
                          INSERT INTO nano_sc_notification (sn_created_date, lead_id, sn_remark, uid, to_id) 
                          VALUES ($1, $2, $3, $4, $5)`, [req.body.created, lead_id, 'New Lead has been Created by ' + by, req.body.created_by, to_id]).then((result) => {

                            return res.status(200).send({ data: lead_id, success: true })
                          }).catch((error) => {
                            console.log(error)
                            return res.status(800).send({ success: false })
                          })


                        }).catch((error) => {
                          console.log(error)
                          return res.status(800).send({ success: false })
                        })
                      } else {
                        return res.status(200).send({ success: true })
                      }
                    }).catch((error) => {
                      console.log(error)
                      return res.status(800).send({ success: false })
                    })

                  }).catch((error) => {
                    console.log(error)
                    return res.status(800).send({ success: false })
                  })

                }).catch((error) => {
                  console.log(error)
                  return res.status(800).send({ success: false })
                })




            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })



      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
  }


})

app.post('/createLead2', async (req, res) => {
  console.log('createLead2')
  req.body.created = new Date().getTime()
  !req.body.sales_exec ? req.body.sales_exec = JSON.stringify([]) : req.body.sales_exec
  // req.body.warranty == undefined || req.body.warranty == '' || req.body.warranty == null || req.body.warranty == false
  if (!req.body.warranty) {
    pool.query(`INSERT INTO nano_leads(created_date, customer_name,
      customer_email, customer_phone, customer_city, customer_state, address, company_address,
      saleexec_note, remark, ads_id, channel_id, sales_admin, services, issues, lattitude, longtitude, sales_coordinator, label_m, label_s, remark_json, status, 
      sc_photo, created_by, race, gender, customer_title, verified, customer_unit, sc_video, sc_document, mkt_created) 
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, $16, $17, $18, $19, $20, $21, true, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31) RETURNING id`,
      [req.body.created, req.body.name, req.body.email, req.body.phone, req.body.city, req.body.state, req.body.address, req.body.comp_address, req.body.sales_note,
      req.body.remark, req.body.ads, req.body.channel, req.body.admin, req.body.services, req.body.issues, req.body.lattitude,
      req.body.longitude, req.body.coordinator, req.body.label_m, req.body.label_s, req.body.remark_json, req.body.sc_photo, req.body.created_by,
      req.body.race, req.body.gender, req.body.title, req.body.verified, req.body.customer_unit, req.body.sc_video, req.body.sc_document, req.body.mkt_created]).then((result) => {
        lead_id = result.rows[0]['id']

        pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`, [req.body.created_by]).then((result) => {
          let by = (result.rows.length > 0 ? result.rows[0]['user_name'] : null)
          pool.query(`INSERT INTO nano_activity_log(lead_id, activity_time, activity_by, remark , activity_type) VALUES ($1, $2, $3, $4, $5)`,
            [lead_id, req.body.created, req.body.created_by, 'Lead created by ' + (result.rows.length > 0 ? result.rows[0]['user_name'] : null), 'Lead']).then((result) => {

              pool.query(`INSERT INTO nano_appointment(lead_id, created_time, appointment_status, assigned_to4 ) VALUES($1, $2, $3, $4)`, [lead_id, req.body.created, true, req.body.sales_exec]).then((result) => {
                let from = new Date().setHours(0, 0, 0, 0)
                let to = new Date().setHours(23, 59, 59, 59)
                if (req.body.coordinator == null) {
                  pool.query(`
                 WITH coord AS(
                  SELECT uid FROM nano_user WHERE user_role = 'Sales Coordinator' AND uid != 'jtCqpxB5FpRKDG0bvXWgEXLxNWG3' AND status = true
                  ),
                  counted AS (
                  SELECT DISTINCT co.uid, coalesce(COUNT(nl.sales_coordinator),0) AS counter FROM coord co
                  LEFT JOIN nano_leads nl ON co.uid = nl.sales_coordinator
                  WHERE nl.created_date >= $2 AND nl.created_date <= $3
                  GROUP BY co.uid  ORDER BY co.uid 
                  ),
                  ordered AS(
                   SELECT co.uid, counter FROM coord co LEFT JOIN counted ct ON ct.uid = co.uid ORDER BY COALESCE(counter, -1) LIMIT 1
                  )               
                  UPDATE nano_leads SET sales_coordinator = (SELECT uid FROM ordered) WHERE id = $1 RETURNING sales_coordinator`, [lead_id, from, to]).then((result) => {

                    let to_id = result.rows[0]['sales_coordinator']

                    pool.query(`
                    INSERT INTO nano_sc_notification (sn_created_date, lead_id, sn_remark, uid, to_id) 
                    VALUES ($1, $2, $3, $4, $5)`, [req.body.created, lead_id, 'New Lead has been Created by ' + by, req.body.created_by, to_id]).then((result) => {

                      return res.status(200).send({ data: lead_id, success: true })
                    }).catch((error) => {
                      console.log(error)
                      return res.status(800).send({ success: false })
                    })

                  }).catch((error) => {
                    console.log(error)
                    return res.status(800).send({ success: false })
                  })
                } else {
                  return res.status(200).send({ success: true })
                }


              }).catch((error) => {
                console.log(error)
                return res.status(800).send({ success: false })
              })


            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })



      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
  } else {
    pool.query(`INSERT INTO nano_leads(created_date, customer_name,
      customer_email, customer_phone, customer_city, customer_state, address, company_address,
      saleexec_note, remark, ads_id, channel_id, sales_admin, services, issues, lattitude, longtitude,
       sales_coordinator, label_m, label_s, remark_json, status, sc_photo, created_by, race, gender, customer_title,verified, customer_unit, sc_video, sc_document, mkt_created) 
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, $16, $17, $18, $19, $20, $21, true, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31) RETURNING id`,
      [req.body.created, req.body.name, req.body.email, req.body.phone, req.body.city, req.body.state, req.body.address, req.body.comp_address, req.body.sales_note,
      req.body.remark, req.body.ads, req.body.channel, req.body.admin, req.body.services, req.body.issues, req.body.lattitude,
      req.body.longitude, req.body.coordinator, req.body.label_m, req.body.label_s, req.body.remark_json, req.body.sc_photo, req.body.created_by,
      req.body.race, req.body.gender, req.body.title, req.body.verified, req.body.customer_unit, req.body.sc_video, req.body.sc_document, req.body.mkt_created]).then((result) => {
        console.log(req.body.created_by);
        lead_id = result.rows[0]['id']
        pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`, [req.body.created_by]).then((result) => {

          pool.query(`INSERT INTO nano_activity_log(lead_id, activity_time, activity_by, remark , activity_type) VALUES ($1, $2, $3, $4, $5)`,
            [req.body.old_lead, req.body.created, req.body.created_by, 'Warranty Form Submitted by Client', 'Warranty']).then((result) => {

              pool.query(`INSERT INTO nano_activity_log(lead_id, activity_time, activity_by, remark , activity_type) VALUES ($1, $2, $3, $4, $5)`,
                [lead_id, req.body.created, req.body.created_by, 'Warranty Lead Created', 'Lead']).then((result) => {
                  pool.query(`INSERT INTO nano_appointment(lead_id, created_time, assigned_to4) VALUES($1, $2, $3)`, [lead_id, req.body.created, req.body.sales_exec]).then((result) => {

                    pool.query(`INSERT INTO nano_warranty(remark, created_date, linked_lead, faulty_area) VALUES($1, $2, $3, $4) RETURNING id
                   `, [req.body.warranty_remark, req.body.created, req.body.old_lead, req.body.faulty_area]).then((result) => {
                      warranty_id = result.rows[0]['id']
                      let from = new Date().setHours(0, 0, 0, 0)
                      let to = new Date().setHours(23, 59, 59, 59)
                      if (req.body.sales_coordinator == null) {
                        pool.query(`
                   WITH coord AS(
                    SELECT uid FROM nano_user WHERE user_role = 'Sales Coordinator' AND uid != 'jtCqpxB5FpRKDG0bvXWgEXLxNWG3' AND status = true
                    ),            
                    counted AS (
                    SELECT DISTINCT co.uid, coalesce(COUNT(nl.sales_coordinator),0) AS counter FROM coord co
                    LEFT JOIN nano_leads nl ON co.uid = nl.sales_coordinator
                    WHERE nl.created_date >= $2 AND nl.created_date <= $3
                    GROUP BY co.uid  ORDER BY co.uid 
                    ),
                    ordered AS(
                     SELECT co.uid, counter FROM coord co LEFT JOIN counted ct ON ct.uid = co.uid ORDER BY COALESCE(counter, -1) LIMIT 1
                    )               
                    UPDATE nano_leads SET sales_coordinator = (SELECT uid FROM ordered), warranty_id = $4 WHERE id = $1`, [lead_id, from, to, warranty_id]).then((result) => {

                          // return res.status(200).send({ data: lead_id, success: true })
                          let to_id = result.rows[0]['sales_coordinator']

                          pool.query(`
                          INSERT INTO nano_sc_notification (sn_created_date, lead_id, sn_remark, uid, to_id) 
                          VALUES ($1, $2, $3, $4, $5)`, [req.body.created, lead_id, 'New Lead has been Created by ' + by, req.body.created_by, to_id]).then((result) => {

                            return res.status(200).send({ data: lead_id, success: true })
                          }).catch((error) => {
                            console.log(error)
                            return res.status(800).send({ success: false })
                          })


                        }).catch((error) => {
                          console.log(error)
                          return res.status(800).send({ success: false })
                        })
                      } else {
                        return res.status(200).send({ success: true })
                      }
                    }).catch((error) => {
                      console.log(error)
                      return res.status(800).send({ success: false })
                    })

                  }).catch((error) => {
                    console.log(error)
                    return res.status(800).send({ success: false })
                  })

                }).catch((error) => {
                  console.log(error)
                  return res.status(800).send({ success: false })
                })




            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })



      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
  }


})

app.post('/getLeadDetail', (req, res) => {
  console.log('getLeadDetail');

  pool.query(`SELECT (SELECT SUM(npl.total) FROM nano_payment_log npl 
  LEFT JOIN nano_sales ns ON npl.sales_id = ns.id 
  LEFT JOIN nano_appointment na2 ON ns.appointment_id = na2.id 
  WHERE na2.lead_id = $1 
  GROUP BY ns.id Limit 1) AS total_price, nls.sales_status, nl.sc_photo AS sc_photo, nl.sc_video AS sc_video,nl.mkt_video, nl.mkt_photo,  nl.mkt_inspect, nl.mkt_install, nl.mkt_inspect_log, nl.mkt_install_log, nl.sc_document AS sc_document, nl.pc_document, nls.assigned_worker, nls.subcon_choice, nls.finance_check, nls.finance_remark,
 nl.id AS lead_id, nla.id AS label_m_id,  nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id,nla2.name AS label_s, nla2.colour AS label_s_colour, nap.checkin AS checkin_time, nap.checkin_img,
  nap.checkin_address, nap.appointment_status, nap.bypass, nl.gender, nl.race, nl.warranty_id, nsc.id AS com_id, 
   nap.appointment_time, nap.kiv,  
 (SELECT JSON_AGG(b.user_name) FROM nano_appointment jna LEFT JOIN nano_user b 
ON b.uid = ANY(SELECT json_array_elements_text(jna.assigned_to4))
 WHERE jna.id = nap.id) as assigned_to4, nl.created_date, nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_signature,
 nl.customer_state, nls.subcon_state,
   nl.address, nl.customer_unit, nl.customer_title, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues, nl.label_photo, nl.label_video,
 nl.status, nl.lattitude, nl.longtitude, nl.ads_id AS ads, nl.channel_id AS channel, nls.id  AS sales_id, nls.status AS whole_status,
   nls.payment_status , nap.id AS appointment_id,nl.remark_json, nu1.user_name AS sales_admin, nls.final_reject_remark, nls.final_reject_title, nls.final_reject_area,
 nu3.user_name AS sales_coordinator,
 (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('created_date', created_date, 'complaint_tb_id', id, 'complaint_remark', complaint_remark,
 'complaint_status', complaint_status,
'complaint_image', complaint_image, 'complaint_video' , complaint_video, 'complaint_reject_remark', reject_remark, 'sub_complaint_details', sub_complaint_details))
FROM nano_sub_complaint WHERE lead_id = $1) as complaint_lists,
 (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('check_lat', nc.check_lat, 'check_long', nc.check_long, 'check_time', 
                    nc.check_time, 'check_img', nc.check_img, 
                   'check_address', nc.check_address, 'check_remark', nc.checK_remark, 'check-status', nc.check_status, 
                    'event_time', nc.event_time, 'complete_status', nc.complete_status)) FROM nano_check nc 
  WHERE nap.id = nc.appointment_id AND nc.status = true) as check_details
  FROM nano_leads nl 
  LEFT JOIN nano_user nu1 ON nl.created_by = nu1.uid 
  LEFT JOIN nano_user nu3 ON nl.sales_coordinator = nu3.uid 
  LEFT JOIN nano_appointment nap ON nap.lead_id = nl.id 
  LEFT JOIN nano_label nla ON nl.label_m = nla.id 
  LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id 
  LEFT JOIN nano_sales nls ON nap.id = nls.appointment_id
  LEFT JOIN LATERAL (
    SELECT *
    FROM nano_sub_complaint nsc
    WHERE nsc.lead_id = nl.id
    ORDER BY nsc.created_date
    LIMIT 1
) nsc ON true
   WHERE nl.id = $1`, [req.body.lead_id]).then((result) => {

    pool.query(`SELECT CASE WHEN COUNT(*) = 0 THEN false
      ELSE true
      END as sales_order_form_exist
      FROM nano_sales_order WHERE lead_id = $1`, [req.body.lead_id]).then((result2) => {

      let temp = result.rows[0]
      temp['sof_exist'] = result2.rows[0]['sales_order_form_exist']

      return res.status(200).send({ data: temp, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
    // return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getLeadDetailPM', (req, res) => {
  console.log('getLeadDetailPM');

  pool.query(`SELECT 
  (SELECT SUM(npl.total) FROM nano_payment_log npl LEFT JOIN nano_sales ns ON npl.sales_id = ns.id LEFT JOIN nano_appointment na2 ON ns.appointment_id = na2.id WHERE na2.lead_id = $1 GROUP BY ns.id Limit 1) AS total_price, 
  nls.sales_status, nl.sc_photo AS sc_photo, nl.sc_video AS sc_video, nl.mkt_video, nl.mkt_photo,  
  nl.mkt_inspect, nl.mkt_install, nl.mkt_inspect_log, nl.mkt_install_log, nl.sc_document AS sc_document, nl.pc_document, 
  nls.assigned_worker, nls.subcon_choice, nls.finance_check, nls.finance_remark, nl.id AS lead_id, 
  nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, 
  nap.checkin AS checkin_time, nap.checkin_img, nap.checkin_address, nap.appointment_status, nap.bypass, nl.gender, nl.race, nl.warranty_id, 
  nap.appointment_time, nap.kiv, (SELECT JSON_AGG(b.user_name) FROM nano_appointment jna LEFT JOIN nano_user b ON b.uid = ANY(SELECT json_array_elements_text(jna.assigned_to4)) WHERE jna.id = nap.id) as assigned_to4, 
  nl.created_date, nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_signature, nl.customer_state, nls.subcon_state,
  nl.address, nl.customer_unit, nl.customer_title, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues, nl.label_photo, nl.label_video,
  nl.status, nl.lattitude, nl.longtitude, nl.ads_id AS ads, nl.channel_id AS channel, nls.id AS sales_id, nls.status AS whole_status, nls.payment_status, 
  nap.id AS appointment_id, nl.remark_json, nu1.user_name AS sales_admin, nls.final_reject_remark, nls.final_reject_title, nls.final_reject_area, nu3.user_name AS sales_coordinator,
  (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('created_date', created_date, 'complaint_tb_id', id, 'complaint_remark', complaint_remark, 'complaint_status', complaint_status,
   'complaint_image', complaint_image, 'complaint_video', complaint_video, 'complaint_reject_remark', reject_remark, 'sub_complaint_details', sub_complaint_details))
   FROM nano_sub_complaint WHERE lead_id = $1) as complaint_lists,
  (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('checkid', sci.id, 'check_time', sci.checkin_time, 'sales_id', sci.sales_id, 'check_img', sci.checkin_img, 
   'check_address', sci.checkin_address, 'check_out', sci.check_out, 'check_useruid', sci.check_useruid, 'check_user_name', (SELECT user_name FROM sub_user WHERE uid = sci.check_useruid))ORDER BY sci.id) 
   FROM sub_check_in sci WHERE nls.id = sci.sales_id) as check_details
FROM nano_leads nl 
LEFT JOIN nano_user nu1 ON nl.created_by = nu1.uid 
LEFT JOIN nano_user nu3 ON nl.sales_coordinator = nu3.uid 
LEFT JOIN nano_appointment nap ON nap.lead_id = nl.id 
LEFT JOIN nano_label nla ON nl.label_m = nla.id 
LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id 
LEFT JOIN nano_sales nls ON nap.id = nls.appointment_id
WHERE nl.id = $1`, [req.body.lead_id]).then((result) => {

    pool.query(`SELECT CASE WHEN COUNT(*) = 0 THEN false
      ELSE true
      END as sales_order_form_exist
      FROM nano_sales_order WHERE lead_id = $1`, [req.body.lead_id]).then((result2) => {

      let temp = result.rows[0]
      temp['sof_exist'] = result2.rows[0]['sales_order_form_exist']

      return res.status(200).send({ data: temp, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
    // return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/updateLeadDetail', (req, res) => {
  console.log('updateLeadDetail');

  let labelm_name
  let labels_name

  pool.query(`select a.name as labelm_name, b.name as labels_name from nano_label a LEFT JOIN nano_label b ON b.id = $2 where a.id = $1`, [req.body.label_m, req.body.label_s]).then((result) => {

    labelm_name = result.rows[0]['labelm_name']
    labels_name = result.rows[0]['labels_name']


    pool.query(`UPDATE nano_leads SET 
  (customer_name, customer_email, customer_phone,customer_state,address, company_address, saleexec_note, ads_id, channel_id,
    sales_exec,services,issues,lattitude,longtitude,status,customer_city,label_m, label_s, remark_json, gender, race, customer_title, sales_coordinator, customer_unit, verified)
    = ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::json, $13, $14, $15, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)  WHERE id =  $16`,
      [req.body.name, req.body.email, req.body.phone, req.body.state, req.body.address, req.body.company_add, req.body.saleexec_note,
      req.body.ads, req.body.channel, req.body.sales_exec, req.body.services, req.body.issues, req.body.lattitude, req.body.longtitude
        , req.body.status, req.body.id, req.body.city, req.body.label_m, req.body.label_s, req.body.remark_json, req.body.gender, req.body.race, req.body.title,
      req.body.sales_coordinator, req.body.customer_unit, req.body.verified]).then((result) => {
        req.body.activity_time = new Date().getTime()


        pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
          [req.body.uid]).then((result) => {
            let name = result.rows[0]['user_name']
            pool.query(`INSERT INTO nano_activity_log(lead_id, activity_time, activity_by, activity_type, remark) VALUES ($1, $2, $3, $4, $5)`,
              [req.body.id, req.body.activity_time, req.body.uid, 'Lead', 'Lead Detail Updated By ' + name + '\n Main Label : ' + labelm_name + '\n Sub Label : ' + labels_name]).then((result) => {

                return res.status(200).send({ success: true })

              }).catch((error) => {
                console.log(error)
                return res.status(800).send({ success: false })
              })

          }).catch((error) => {
            console.log(error)
            return res.status(800).send({ success: false })
          })


      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

// app.post('/updateLeadDetail', (req, res) => {
//   console.log('updateLeadDetail');

//   pool.query(`UPDATE nano_leads SET 
//   (customer_name, customer_email, customer_phone,customer_state,address, company_address, saleexec_note,remark,ads_id,channel_id,
//     sales_exec,services,issues,lattitude,longtitude,sales_coordinator,status,customer_city,label_m, label_s, remark_json)
//     = ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::json, $14, $15, $16, $17, $19, $20, $21, $22)  WHERE id =  $18`,
//     [req.body.name, req.body.email, req.body.phone, req.body.state, req.body.address, req.body.company_add, req.body.saleexec_note, req.body.remark,
//     req.body.ads, req.body.channel, req.body.sales_exec, req.body.services, req.body.issues, req.body.lattitude, req.body.longtitude, req.body.sales_coord
//       , req.body.status, req.body.id, req.body.city, req.body.label_m, req.body.label_s, req.body.remark_json]).then((result) => {

//         return res.status(200).send({ success: true })

//       }).catch((error) => {
//         console.log(error)
//         return res.status(800).send({ success: false })
//       })

// })


/////////////////////////////////////////////////////////////////////////////////
//      i need one api for get customer data and subcon task list              //
//       hi hi hello hello hi hi                                               //
// customer name, phone, address, project manager remark, task_place, service  //
// *dont spoil                                                                 //
/////////////////////////////////////////////////////////////////////////////////

app.post('/updatePaymentEmailPhoto', (req, res) => {
  console.log('updatePaymentEmailPhoto');
  pool.query(`UPDATE nano_payment_log SET email_approval = $1 WHERE id =  $2`,
    [req.body.email_approval, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updateLeadScPhoto', (req, res) => {
  console.log('updateLeadScPhoto');
  pool.query(`UPDATE nano_leads SET 
  sc_photo = $1  WHERE id =  $2`,
    [req.body.sc_photo, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


app.post('/updateLeadScVideo', (req, res) => {
  console.log('updateLeadScVideo');
  pool.query(`UPDATE nano_leads SET 
  sc_video = $1  WHERE id =  $2`,
    [req.body.sc_video, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

// sc_document

app.post('/updateLeadScDocument', (req, res) => {
  console.log('updateLeadScDocument');
  pool.query(`UPDATE nano_leads SET 
  sc_document = $1  WHERE id =  $2`,
    [req.body.sc_document, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})

// Pc document
app.post('/updateLeadPcDocument', (req, res) => {
  console.log('updateLeadPcDocument');
  pool.query(`UPDATE nano_leads SET 
  pc_document = $1 WHERE id =  $2`,
    [req.body.pc_document, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})

app.post('/updateLeadMktPhoto', (req, res) => {
  console.log('updateLeadMktPhoto');
  pool.query(`UPDATE nano_leads SET 
  mkt_photo = $1  WHERE id =  $2`,
    [req.body.mkt_photo, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updateLeadMktVideo', (req, res) => {
  console.log('updateLeadMktVideo');
  pool.query(`UPDATE nano_leads SET 
  mkt_video = $1  WHERE id =  $2`,
    [req.body.mkt_video, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updateLeadMktStatus', (req, res) => {
  console.log('updateLeadMktStatus');
  pool.query(`UPDATE nano_leads SET (mkt_inspect, mkt_install, mkt_inspect_log, mkt_install_log) = ($1, $2, $3, $4) WHERE id =  $5`,
    [req.body.mkt_inspect, req.body.mkt_install, req.body.mkt_inspect_log, req.body.mkt_install_log, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updateLeadMktStatus2', async (req, res) => {
  console.log('updateLeadMktStatus2');
  let now = new Date().getTime();
  let kosong = JSON.stringify([]);

  try {
    const result = await pool.query(`
      WITH updateleadmktstatus AS (
        UPDATE nano_leads 
        SET (mkt_inspect, mkt_install, mkt_inspect_log, mkt_install_log) = ($1, $2, $3, $4) 
        WHERE id = $5 
        RETURNING id
      ),
      insertactivitylog AS (
        INSERT INTO nano_activity_log (lead_id, sales_id, activity_time, activity_by, remark, activity_type) 
        VALUES ($5, $10, $6, $7, $8, $9)
      ),
      insertscnotification AS (
        INSERT INTO nano_sc_notification (sn_created_date, sales_id, lead_id, sn_remark, uid, to_id) 
        VALUES ($6, $10, $5, $8, $7, (SELECT sales_coordinator FROM nano_leads WHERE id = $5))
      )
      SELECT * FROM updateleadmktstatus
    `, [req.body.mkt_inspect, req.body.mkt_install, req.body.mkt_inspect_log, req.body.mkt_install_log, req.body.id, now, req.body.activity_by, req.body.remark, req.body.activity_type, req.body.sales_id]);

    return res.status(200).send({ success: true });
  } catch (error) {
    console.log(error);
    return res.status(800).send({ message: error, success: false });
  }
});

app.post('/updatePackageInstallPhoto', (req, res) => {
  console.log('updatePackageInstallPhoto');
  pool.query(`UPDATE nano_sales_package SET 
  sub_image = $1 WHERE sap_id = $2`,
    [req.body.sub_image, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updatePackageInstallVideo', (req, res) => {
  console.log('updatePackageInstallVideo');
  pool.query(`UPDATE nano_sales_package SET 
  sub_video = $1 WHERE sap_id = $2`,
    [req.body.sub_video, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updatePackageComplaintPhoto', (req, res) => {
  console.log('updatePackageComplaintPhoto');

  if (!req.body.sub_complaint_image) {
    req.body.sub_complaint_image = JSON.stringify([])
  }

  pool.query(`UPDATE nano_sales_package SET 
  sub_complaint_image = $1 WHERE sap_id = $2`,
    [req.body.sub_complaint_image, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updatePackageComplaintVideo', (req, res) => {
  console.log('updatePackageComplaintVideo');

  if (!req.body.sub_complaint_video) {
    req.body.sub_complaint_video = JSON.stringify([])
  }

  pool.query(`UPDATE nano_sales_package SET 
  sub_complaint_video = $1 WHERE sap_id = $2`,
    [req.body.sub_complaint_video, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


//GET AC_APPROVAL AND SC_APPROVAL PAYMENT LOG
app.get('/getAcPaymentLog', (req, res) => {
  console.log('getAcPaymentLog');

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }

    client.query(`
        SELECT nl.id AS lead_id, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.created_date, nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state,
        nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id, nls.payment_status, nls.total AS payment_total, nls.sales_status,
        (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
        (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, nls.subcon_state,
        nl.lattitude, nl.longtitude, u1.user_name AS created_by, u2.user_name AS sales_exec, u3.user_name AS sales_coord, nlp.*, nl.sales_coordinator, nap.assigned_to4,
        (SELECT JSON_AGG(user_name) FROM nano_user WHERE uid IN (SELECT value::text FROM JSONB_ARRAY_ELEMENTS_TEXT(nap.assigned_to4::JSONB))) AS user_name
        FROM nano_leads nl LEFT JOIN nano_user u1 ON nl.sales_admin = u1.uid LEFT JOIN nano_user u2 ON nl.sales_exec = u2.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
        LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN nano_appointment nap ON nap.lead_id = nl.id LEFT JOIN 
        nano_sales nls ON nap.id = nls.appointment_id LEFT JOIN nano_payment_log nlp ON nls.id = nlp.sales_id WHERE nlp.ac_approval IS NULL AND nlp.total IS NOT NULL`
    ).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    })

  })



})

app.get('/getScPaymentLog', (req, res) => {
  console.log('getScPaymentLog');

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }


    client.query(`
  SELECT nl.id AS lead_id, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.created_date, nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state,
  nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id, nls.payment_status, nls.total AS payment_total, nls.sales_status,
  (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
  (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, nls.subcon_state,
  nl.lattitude, nl.longtitude, u1.user_name AS created_by, u2.user_name AS sales_exec, u3.user_name AS sales_coord, nlp.* , nl.sales_coordinator, nap.assigned_to4,
  (SELECT JSON_AGG(user_name) FROM nano_user WHERE uid IN (SELECT value::text FROM JSONB_ARRAY_ELEMENTS_TEXT(nap.assigned_to4::JSONB))) AS user_name
  FROM nano_leads nl LEFT JOIN nano_user u1 ON nl.sales_admin = u1.uid LEFT JOIN nano_user u2 ON nl.sales_exec = u2.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
  LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN nano_appointment nap ON nap.lead_id = nl.id LEFT JOIN 
  nano_sales nls ON nap.id = nls.appointment_id LEFT JOIN nano_payment_log nlp ON nls.id = nlp.sales_id WHERE nlp.sc_approval IS NULL AND nlp.total IS NOT NULL`
    ).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      release()
      return res.status(800).send({ success: false })
    })

  })



})

//update payment status
//ac sc
app.post('/updatePaymentStatus', (req, res) => {
  console.log('updatePaymentStatus');

  pool.query(`UPDATE nano_sales SET payment_status = $1, sales_status = $2 WHERE id =  $3`,
    [req.body.payment_status, req.body.sales_status, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updateApproval', (req, res) => {
  console.log('updateApproval');
  if (req.body.role == 'ac') {

    pool.query(`UPDATE nano_payment_log SET (ac_approval, remark_ac_reject, remark_sc_reject) = ($1,$2, $4) WHERE id =  $3`,
      [req.body.approval, req.body.remark_ac_reject, req.body.id, req.body.remark_sc_reject]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
  } else if (req.body.role == 'sc') {

    pool.query(`UPDATE nano_payment_log SET (sc_approval, remark_sc_reject, remark_ac_reject) = ($1,$2, $4) WHERE id =  $3`,
      [req.body.approval, req.body.remark_sc_reject, req.body.id, req.body.remark_ac_reject]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
  } else if (req.body.role == 'sp') {

    pool.query(`UPDATE nano_payment_log SET (sp_paul_approve, sp_approval_log) = ($1,$2) WHERE id = $3`,
      [req.body.sp_paul_approve, req.body.sp_approval_log, req.body.id]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
  } else if (req.body.role == 'splead') {
    // const sp_leader_name = req.body.sp_leader_name || null;

    pool.query(`UPDATE nano_payment_log SET (sp_leader_approve, sp_approval_log, sp_leader_name) = ($1,$2, $4) WHERE id = $3`,
      [req.body.sp_leader_approve, req.body.sp_approval_log, req.body.id, req.body.sp_leader_name]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
  }


})


//
app.post('/uploadCustomQuotation', (req, res) => {
  console.log('uploadCustomQuotation');
  let now = new Date().getTime()
  pool.query(`UPDATE nano_sales SET (custom_quotation, quotation_submit_date) = ($1::json, $2) WHERE id = $3`,
    [req.body.quotation, now, req.body.sales_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

//upload receipt
app.post('/updatePaymentReceipt', (req, res) => {
  console.log('updatePaymentReceipt');
  pool.query(`UPDATE nano_payment_log SET receipt = $1::json WHERE id = $2`,
    [req.body.receipt, req.body.payment_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})


// getSales
app.post('/updateSubLabel', (req, res) => {
  console.log('updateSubLabel');

  pool.query(`UPDATE nano_leads SET label_s = $1 WHERE id =  $2`,
    [req.body.label_s, req.body.id])
    .then((result) => {
      req.body.activity_time = new Date().getTime()
      pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
        [req.body.uid])
        .then((result) => {
          pool.query(`INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, activity_type) VALUES ($1, $2, $3, $4, $5)`,
            [req.body.id, req.body.activity_time, req.body.uid, 'Sub Label Updated By ' + (result.rows.length > 0 ? result.rows[0]['user_name'] : null), 'Label'])

            // pool.query(`
            //           INSERT INTO nano_activity_log (lead_id, appointment_id, activity_time, activity_by, remark, activity_type) 
            //           VALUES((SELECT nl.id FROM nano_leads nl LEFT JOIN nano_appointment na ON nl.id = na.lead_id WHERE na.id = $1), 
            //           $1, $2, $3, $4, $5)
            //         `,
            //       [req.body.appointment_id, req.body.created_date, req.body.uid, 'Appointment Checked In By ' + by, 'Appointment'])
            .then((result) => {

              return res.status(200).send({ success: true })

            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })


        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updateSubLabel2', (req, res) => {
  console.log('updateSubLabel2');

  pool.query(`UPDATE nano_leads SET (label_s, label_m) = ($1, $3) WHERE id =  $2`,
    [req.body.label_s, req.body.id, req.body.label_m])
    .then((result) => {
      req.body.activity_time = new Date().getTime()
      pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
        [req.body.uid])
        .then((result) => {
          pool.query(`INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, activity_type) VALUES ($1, $2, $3, $4, $5)`,
            [req.body.id, req.body.activity_time, req.body.uid, 'Sub Label Updated By ' + (result.rows.length > 0 ? result.rows[0]['user_name'] : null), 'Label'])

            // pool.query(`
            //           INSERT INTO nano_activity_log (lead_id, appointment_id, activity_time, activity_by, remark, activity_type) 
            //           VALUES((SELECT nl.id FROM nano_leads nl LEFT JOIN nano_appointment na ON nl.id = na.lead_id WHERE na.id = $1), 
            //           $1, $2, $3, $4, $5)
            //         `,
            //       [req.body.appointment_id, req.body.created_date, req.body.uid, 'Appointment Checked In By ' + by, 'Appointment'])
            .then((result) => {

              return res.status(200).send({ success: true })

            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })


        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updateLeadsApp', (req, res) => {
  console.log('updateLeadsApp');

  pool.query(`UPDATE nano_leads SET sales_exec = $1 WHERE id = $2 `, [req.body.sales_exec, req.body.id]).then((result) => {
    req.body.activity_time = new Date().getTime()

    pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
      [req.body.uid])
      .then((result) => {
        let by = result.rows[0]['user_name']
        pool.query(`INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, activity_type) VALUES ($1, $2, $3, $4, $5)`,
          [req.body.id, req.body.activity_time, req.body.uid, 'Lead Sales Exec Updated By ' + by, "Lead"])
          .then((result) => {

            return res.status(200).send({ success: true })

          }).catch((error) => {
            console.log(error)
            return res.status(800).send({ success: false })
          })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })



  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})





// app.post('/createAppointment', (req, res) => {
//   console.log('createAppointment');

//   pool.query(`INSERT INTO 
//   nano_appointment(lead_id, created_time, appointment_time, appointment_status, remark, assigned_to4) 
//   VALUES($1, $2, $3, $4, $5, $6) `
//     , [req.body.lead_id, req.body.created_time, req.body.appointment_time, req.body.status, req.body.remark, req.body.user_id]).then((result) => {

//       return res.status(200).send({ success: true })

//     }).catch((error) => {
//       console.log(error)
//       return res.status(800).send({ success: false })
//     })

// })

// app.post('/updateAppointmentsDetails', (req, res) => {
//   console.log('updateAppointmentsDetails');
//   console.log(req.body);

//   pool.query(`UPDATE nano_appointment SET (appointment_status, remark, assigned_to4, appointment_time,sales_exec_note) = ($1, $2, $3, $4, $5) WHERE lead_id = $6 `
//     , [req.body.status, req.body.remark, req.body.assigned_to4, req.body.appointment_time, req.body.sales_exec_note, req.body.id]).then((result) => {

//       return res.status(200).send({ success: true })

//     }).catch((error) => {
//       console.log(error)
//       return res.status(800).send({ success: false })
//     })

// })

app.post('/updateLeadAppointment', (req, res) => {
  console.log('updateLeadAppointment');

  pool.query('SELECT id from nano_appointment WHERE lead_id = $1', [req.body.id]).then((checker) => {
    let created = new Date().getTime()

    if (checker.rows.length < 1) {
      pool.query(`INSERT INTO nano_appointment(lead_id, created_time, assigned_to4, appointment_status) VALUES($1, $2, $3, $4)`, [req.body.id, created, req.body.assigned_to4, true]).then((result) => {

        pool.query(`UPDATE nano_leads SET (address,lattitude, longtitude, remark,saleexec_note, sales_exec, customer_unit) = ($1, $2, $3, $4, $5, $6, $8) WHERE id = $7 `
          , [req.body.address, req.body.lattitude, req.body.longtitude, req.body.remark, req.body.sales_exec_note, req.body.sales_exec, req.body.id, req.body.customer_unit]).then((result) => {

            pool.query(`UPDATE nano_appointment SET (appointment_status, remark, assigned_to4, appointment_time,sales_exec_note, kiv, bypass) = ($1, $2, $3, $4, $5, $6, $8) WHERE lead_id = $7 RETURNING id `
              , [req.body.status, req.body.remark, req.body.assigned_to4, req.body.appointment_time, req.body.sales_exec_note, req.body.kiv, req.body.id, (req.body.bypass ? req.body.bypass : false)]).then((result) => {

                req.body.appointment_id = result.rows[0]['id']

                pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`
                  , [req.body.uid]).then((result) => {
                    req.body.activity_time = new Date().getTime()
                    pool.query(`INSERT INTO nano_activity_log(lead_id, appointment_id, activity_time, activity_by, remark, activity_type) VALUES($1, $2, $3, $4, $5, $6)`
                      , [req.body.id, req.body.appointment_id, req.body.activity_time, req.body.uid, 'Appointment Updated By ' + (result.rows.length > 0 ? result.rows[0]['user_name'] : null), 'Appointment']).then((result) => {

                        // return res.status(200).send({ success: true })
                        pool.query(`SELECT id FROM nano_sales WHERE lead_id = $1`
                          , [req.body.id]).then((checksales) => {
                            if (checksales.rows.length < 1) {

                              let created_date = new Date().getTime()
                              req.body.discount_image = JSON.stringify([])
                              req.body.discount_applied = JSON.stringify([])
                              req.body.custom_quotation = JSON.stringify([])
                              req.body.gen_quotation = JSON.stringify([])
                              req.body.subcon_choice = JSON.stringify([])
                              pool.query(`
                                INSERT INTO nano_sales
                                  (created_date, lead_id,  appointment_id, discount_image, discount_applied, subcon_choice
                                   , custom_quotation, gen_quotation, finance_check, status)
                                 VALUES ($1,$2,$3, $4, $5, $6,$7, $8, null, false)`,
                                [created_date, req.body.id, req.body.appointment_id,
                                  req.body.discount_image, req.body.discount_applied, req.body.subcon_choice, req.body.custom_quotation, req.body.gen_quotation]).then((result) => {

                                    return res.status(200).send({ success: true })

                                  }).catch((error) => {
                                    console.log(error)
                                    return res.status(800).send({ success: false })
                                  })
                            }
                            else {
                              return res.status(200).send({ success: true })
                            }


                          }).catch((error) => {
                            console.log(error)
                            return res.status(800).send({ success: false })
                          })

                      }).catch((error) => {
                        console.log(error)
                        return res.status(800).send({ success: false })
                      })

                  }).catch((error) => {
                    console.log(error)
                    return res.status(800).send({ success: false })
                  })



              }).catch((error) => {
                console.log(error)
                return res.status(800).send({ success: false })
              })

          }).catch((error) => {
            console.log(error)
            return res.status(800).send({ success: false })
          })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }
    else {
      pool.query(`UPDATE nano_leads SET (address,lattitude, longtitude, remark,saleexec_note, sales_exec) = ($1, $2, $3, $4, $5, $6) WHERE id = $7 `
        , [req.body.address, req.body.lattitude, req.body.longtitude, req.body.remark, req.body.sales_exec_note, req.body.sales_exec, req.body.id]).then((result) => {

          pool.query(`UPDATE nano_appointment SET (appointment_status, remark, assigned_to4, appointment_time,sales_exec_note, kiv, bypass) = ($1, $2, $3, $4, $5, $6, $8) WHERE lead_id = $7 RETURNING id `
            , [req.body.status, req.body.remark, req.body.assigned_to4, req.body.appointment_time, req.body.sales_exec_note, req.body.kiv, req.body.id, (req.body.bypass ? req.body.bypass : false)]).then((result) => {
              req.body.appointment_id = result.rows[0]['id']
              let created = new Date().getTime()
              pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`
                , [req.body.uid]).then((result) => {
                  req.body.activity_time = new Date().getTime()
                  pool.query(`INSERT INTO nano_activity_log(lead_id, appointment_id, activity_time, activity_by, remark, activity_type) VALUES($1, $2, $3, $4, $5, $6)`
                    , [req.body.id, req.body.appointment_id, req.body.activity_time, req.body.uid, 'Appointment Updated By ' + (result.rows.length > 0 ? result.rows[0]['user_name'] : null), 'Appointment']).then((result) => {

                      // return res.status(200).send({ success: true })
                      pool.query(`SELECT id FROM nano_sales WHERE lead_id = $1`
                        , [req.body.id]).then((checksales) => {
                          if (checksales.rows.length < 1) {

                            let created_date = new Date().getTime()
                            req.body.discount_image = JSON.stringify([])
                            req.body.discount_applied = JSON.stringify([])
                            req.body.custom_quotation = JSON.stringify([])
                            req.body.gen_quotation = JSON.stringify([])
                            req.body.subcon_choice = JSON.stringify([])
                            pool.query(`
                              INSERT INTO nano_sales
                                (created_date, lead_id,  appointment_id, discount_image, discount_applied , subcon_choice
                                 , custom_quotation, gen_quotation, finance_check, status)
                               VALUES ($1,$2,$3, $4, $5, $6, $7, $8, null, false)`,
                              [created_date, req.body.id, req.body.appointment_id,
                                req.body.discount_image, req.body.discount_applied, req.body.subcon_choice, req.body.custom_quotation, req.body.gen_quotation]).then((result) => {

                                  return res.status(200).send({ success: true })

                                }).catch((error) => {
                                  console.log(error)
                                  return res.status(800).send({ success: false })
                                })
                          }
                          else {
                            return res.status(200).send({ success: true })
                          }


                        }).catch((error) => {
                          console.log(error)
                          return res.status(800).send({ success: false })
                        })

                    }).catch((error) => {
                      console.log(error)
                      return res.status(800).send({ success: false })
                    })

                }).catch((error) => {
                  console.log(error)
                  return res.status(800).send({ success: false })
                })



            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })
    }
  })



})


app.post('/updateLeadAppointmentforapp', (req, res) => {
  console.log('updateLeadAppointmentforapp');

  pool.query('SELECT id from nano_appointment WHERE lead_id = $1', [req.body.id]).then((checker) => {

    let created = new Date().getTime()

    if (checker.rows.length < 1) {
      pool.query(`INSERT INTO nano_appointment(lead_id, created_time, assigned_to4, appointment_status) VALUES($1, $2, $3, $4)`, [req.body.id, created, req.body.assigned_to4, true]).then((result) => {

        pool.query(`UPDATE nano_leads SET (address,lattitude, longtitude, remark,saleexec_note, sales_exec, customer_unit) = ($1, $2, $3, $4, $5, $6, $8) WHERE id = $7 `
          , [req.body.address, req.body.lattitude, req.body.longtitude, req.body.remark, req.body.sales_exec_note, req.body.sales_exec, req.body.id, req.body.customer_unit]).then((result) => {

            pool.query(`UPDATE nano_appointment SET (appointment_status, remark, appointment_time,sales_exec_note) = ($1, $2, $3, $4) 
            WHERE lead_id = $6 RETURNING id `
              , [req.body.status, req.body.remark, req.body.appointment_time, req.body.sales_exec_note, req.body.id]).then((result) => {

                req.body.appointment_id = result.rows[0]['aid']

                pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`
                  , [req.body.uid]).then((result) => {
                    req.body.activity_time = new Date().getTime()

                    pool.query(`INSERT INTO nano_activity_log(lead_id, appointment_id, activity_time, activity_by, remark, activity_type) VALUES($1, $2, $3, $4, $5, $6)`
                      , [req.body.id, req.body.appointment_id, req.body.activity_time, req.body.uid, 'Appointment Updated By ' + (result.rows.length > 0 ? result.rows[0]['user_name'] : null), 'Appointment']).then((result) => {

                        return res.status(200).send({ success: true })

                      }).catch((error) => {
                        console.log(error)
                        return res.status(800).send({ success: false })
                      })

                  }).catch((error) => {
                    console.log(error)
                    return res.status(800).send({ success: false })
                  })



              }).catch((error) => {
                console.log(error)
                return res.status(800).send({ success: false })
              })

          }).catch((error) => {
            console.log(error)
            return res.status(800).send({ success: false })
          })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }
    else {
      pool.query(`UPDATE nano_leads SET (address,lattitude, longtitude, remark,saleexec_note, sales_exec) = ($1, $2, $3, $4, $5, $6) WHERE id = $7 `
        , [req.body.address, req.body.lattitude, req.body.longtitude, req.body.remark, req.body.sales_exec_note, req.body.sales_exec, req.body.id]).then((result) => {

          pool.query(`UPDATE nano_appointment SET (appointment_status, remark, appointment_time,sales_exec_note, kiv) = ($1, $2, $3, $4, $5) WHERE lead_id = $6 RETURNING id `
            , [req.body.status, req.body.remark, req.body.appointment_time, req.body.sales_exec_note, req.body.kiv, req.body.id]).then((result) => {

              req.body.appointment_id = result.rows[0]['aid']
              let created = new Date().getTime()
              pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`
                , [req.body.uid]).then((result) => {
                  req.body.activity_time = new Date().getTime()

                  pool.query(`INSERT INTO nano_activity_log(lead_id, appointment_id, activity_time, activity_by, remark, activity_type) VALUES($1, $2, $3, $4, $5, $6)`
                    , [req.body.id, req.body.appointment_id, req.body.activity_time, req.body.uid, 'Appointment Updated By ' + (result.rows.length > 0 ? result.rows[0]['user_name'] : null), 'Appointment']).then((result) => {

                      return res.status(200).send({ success: true })

                    }).catch((error) => {
                      console.log(error)
                      return res.status(800).send({ success: false })
                    })

                }).catch((error) => {
                  console.log(error)
                  return res.status(800).send({ success: false })
                })



            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })
    }
  })



})

app.post('/searchLeadList', async (req, res) => {
  console.log('searchLeadList')
  pool.query(`WITH selected AS (
    SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
      (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
      (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
      ELSE nl.created_date::bigint end) AS created_date,
      (SELECT created_date FROM nano_sales WHERE appointment_id = nat.id LIMIT 1) AS appoint_date,
      CASE 
      WHEN nl.customer_phone IS NULL THEN 0
      ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
      END as phone_row_number,
      CASE 
      WHEN nl.address IS NULL THEN 0
      ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
      END as address_row_number,
      nls.status AS whole_status,
      nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
        nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
        nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.checkin, nls.final_approval,
        (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
        (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
        (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
        nls.subcon_state, nls.finance_check, nls.finance_remark, 
        (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
        nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
        FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
        LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
        nano_sales nls ON nat.id = nls.appointment_id 
      ) SELECT * FROM selected WHERE (customer_name ILIKE $1 OR customer_phone ILIKE $1 OR customer_city ILIKE $1 OR customer_state ILIKE $1 OR address ILIKE $1) LIMIT 1500`, ['%' + req.body.keyword + '%']
  ).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

//getleadgroupbyphone
app.get('/getLeadGroupByPhone', async (req, res) => {
  console.log('getLeadGroupByPhone')
  pool.query(`SELECT COUNT(*), customer_phone, MAX(customer_name) AS customer_name FROM nano_leads GROUP BY customer_phone ORDER BY MAX(created_date) DESC LIMIT 1500`).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})


app.post('/searchLeadGroupByPhone', async (req, res) => {
  console.log('searchLeadGroupByPhone')
  pool.query(`SELECT COUNT(*), customer_phone, MAX(customer_name) AS customer_name FROM nano_leads  WHERE (LOWER(customer_name) ILIKE $1 OR customer_phone ILIKE $1) GROUP BY customer_phone ORDER BY MAX(created_date) DESC LIMIT 1500`, ['%' + req.body.keyword + '%']).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

//lead by phone number / customer_phone
app.post('/getLeadListByPhoneNumber', async (req, res) => {
  console.log('getLeadListByPhoneNumber')
  pool.query(`WITH selected AS (
    SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
      (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
      (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
      ELSE nl.created_date::bigint end) AS created_date,
      CASE 
      WHEN nl.customer_phone IS NULL THEN 0
      ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
      END as phone_row_number,
      CASE 
      WHEN nl.address IS NULL THEN 0
      ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
      END as address_row_number,
      nls.status AS whole_status,
      nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
        nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
        nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to, nat.checkin, nls.final_approval,
        (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
        (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
        (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
        nls.subcon_state, nls.finance_check, nls.finance_remark, 
        (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
        nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
        FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
        LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
        nano_sales nls ON nat.id = nls.appointment_id WHERE customer_phone LIKE $1
      ) SELECT * FROM selected`, ['%' + req.body.customer_phone + '%']
  ).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})


app.get('/getFinanceList', async (req, res) => {
  console.log('getLeadList')
  pool.query(`SELECT DISTINCT ON (nano_leads.id) nano_leads.*, nano_sales.*, 
  substring(subcon_service_form.serviceform from '/nano/([^/]+)-') AS service_form_num,
  substring(nano_sales_order.orderform from '/nano/([^/]+)-') AS sof_num,
  (SELECT JSON_AGG(b.user_name) FROM nano_appointment jna LEFT JOIN nano_user b 
ON b.uid = ANY(SELECT json_array_elements_text(jna.assigned_to4))
 WHERE jna.id = nap.id) as assigned_to4
  FROM nano_leads 
  LEFT JOIN nano_appointment nap ON nap.lead_id = nano_leads.id 
  LEFT JOIN nano_sales ON nano_sales.lead_id = nano_leads.id 
  LEFT JOIN subcon_service_form ON subcon_service_form.lead_id = nano_leads.id 
  LEFT JOIN nano_sales_order ON nano_sales_order.lead_id = nano_leads.id 
  WHERE nano_sales.total IS NOT NULL`
  ).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

// app.get('/getAllLeadList', async (req, res) => {
//   console.log('getAllLeadList')

//   pool.connect((err, client, release) => {
//     if (err) {
//       release()
//       return res.status(200).send({ success: false })
//     }

//     client.query(`WITH selected AS (
//             SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
//               nc.no AS check_details,
//               (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
//               (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
//               ELSE nl.created_date::bigint end) AS created_date,
//               (SELECT created_date FROM nano_sales WHERE appointment_id = nat.id LIMIT 1) AS appoint_date,
//             CASE 
//             WHEN nl.customer_phone IS NULL THEN 0
//             ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
//             END as phone_row_number,
//               nls.status AS whole_status,
//               nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
//                 nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id, nat.appointment_status, nls.payment_status, 
//                 nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to, nat.checkin, nat.kiv,
//                 (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
//                 (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
//                 (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
//                 nls.subcon_state, nls.finance_check, nls.finance_remark, 
//                 CASE
//                 WHEN (nls.gen_quotation::TEXT = '[]' OR nls.gen_quotation IS NULL) AND (nls.custom_quotation::TEXT = '[]' OR nls.custom_quotation IS NULL) THEN false
//                 else true
//                 END as got_quotation,
//                 (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
//                 nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
//                 FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
//                 LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
//                 nano_sales nls ON nat.id = nls.appointment_id LEFT JOIN nano_check nc ON  nc.appointment_id = nat.id ORDER BY lead_id asc
//               ) SELECT DISTINCT ON (s.lead_id) s.*, (SELECT created_date AS sof_latest_created_date FROM nano_sales_order nso WHERE nso.lead_id = s.lead_id ORDER BY nso.created_date LIMIT 1)
//               FROM selected s
//               ORDER BY s.lead_id`
//     ).then((result) => {
//       release()
//       return res.status(200).send({ data: result.rows, success: true })

//     }).catch((error) => {
//       release()
//       console.log(error)
//       return res.status(800).send({ success: false })
//     })

//   })

// })

app.get('/getOverview', async (req, res) => {
  console.log('getOverview')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }

    const currentDate = new Date();

    // Current Month
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).getTime();

    // Last Month
    const startOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).getTime();
    const endOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0, 23, 59, 59).getTime();

    // This Year
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1).getTime();
    const endOfYear = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59).getTime();

    // Last Year
    const startOfLastYear = new Date(currentDate.getFullYear() - 1, 0, 1).getTime();
    const endOfLastYear = new Date(currentDate.getFullYear() - 1, 11, 31, 23, 59, 59).getTime();

    const query = `SELECT 
    COUNT(*) AS all,
    COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 THEN 1 ELSE NULL END) AS this_month,
    COUNT(CASE WHEN nl.created_date BETWEEN $3 AND $4 THEN 1 ELSE NULL END) AS last_month,
    COUNT(CASE WHEN nl.created_date BETWEEN $5 AND $6 THEN 1 ELSE NULL END) AS this_year,
    COUNT(CASE WHEN nl.created_date BETWEEN $7 AND $8 THEN 1 ELSE NULL END) AS last_year,
    COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 AND nl.label_s = 2 THEN 1 ELSE NULL END) AS follow_up,
    COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 AND nl.label_s = 11 THEN 1 ELSE NULL END) AS attending,
    COUNT(CASE WHEN ns.gen_quotation IS NOT NULL
      AND json_array_length(ns.gen_quotation) > 0
      AND (
        SELECT (json_array_elements(ns.gen_quotation)->>'date')::BIGINT
        FROM json_array_elements(ns.gen_quotation)
        ORDER BY (json_array_elements(ns.gen_quotation)->>'date')::BIGINT DESC
        LIMIT 1
      ) BETWEEN CAST($1 AS BIGINT) AND CAST($2 AS BIGINT) 
      THEN 1 ELSE NULL END) AS quotation,
    COUNT(DISTINCT CASE WHEN nso.lead_id = nl.id AND CAST(nso.created_date AS BIGINT) BETWEEN CAST($1 AS BIGINT) AND CAST($2 AS BIGINT) THEN nso.created_date ELSE NULL END) AS sales_close
  FROM nano_leads nl
  LEFT JOIN (
    SELECT lead_id, MAX(CAST(created_date AS BIGINT)) AS created_date
    FROM nano_sales_order
    GROUP BY lead_id
  ) nso ON nso.lead_id = nl.id
  LEFT JOIN nano_sales ns ON ns.lead_id = nl.id  
  `;

    client.query(query, [
      startOfMonth, endOfMonth,      // Current Month
      startOfLastMonth, endOfLastMonth, // Last Month
      startOfYear, endOfYear,       // This Year
      startOfLastYear, endOfLastYear // Last Year
    ]).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })
    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    })
  })
})

app.post('/getOverview2', async (req, res) => {
  console.log('getOverview2');

  const { selectyear, startdate, enddate } = req.body;

  pool.connect((err, client, release) => {
    if (err) {
      release();
      return res.status(200).send({ success: false });
    }

    //   COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 
    //     AND nl.label_s NOT IN (2, 11, 80, 81) 
    //     AND nl.label_s NOT IN (SELECT id FROM nano_label WHERE category = 'Unable To Do')
    //     AND nl.label_s NOT IN (SELECT id FROM nano_label WHERE category = 'Follow Up') 
    // THEN 1 ELSE NULL END) AS other,
    const query = `
      SELECT 
        COUNT(*) AS all,
        COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 THEN 1 ELSE NULL END) AS selected_period,
        COUNT(CASE WHEN nl.created_date BETWEEN $3 AND $4 THEN 1 ELSE NULL END) AS last_period,
        COUNT(CASE WHEN nl.created_date BETWEEN $5 AND $6 THEN 1 ELSE NULL END) AS this_year,
        COUNT(CASE WHEN nl.created_date BETWEEN $7 AND $8 THEN 1 ELSE NULL END) AS last_year,
        COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 AND nl.label_s = 2 THEN 1 ELSE NULL END) AS to_follow,
        COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 AND nl.label_s IN (11, 46) THEN 1 ELSE NULL END) AS attending,
        COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 AND nl.label_s IN (80, 81) THEN 1 ELSE NULL END) AS cancel_reschedule,
        COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 AND nl.label_s IN (SELECT id FROM nano_label 
          WHERE category = 'Unable To Do') 
        THEN 1 ELSE NULL END) AS unable,
        COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 AND nl.label_s IN (SELECT id FROM nano_label WHERE category = 'Follow Up') 
        THEN 1 ELSE NULL END) AS followed,
        COUNT(DISTINCT CASE WHEN nso.lead_id = nl.id AND CAST(nso.created_date AS BIGINT) BETWEEN CAST($1 AS BIGINT) AND CAST($2 AS BIGINT) THEN nso.created_date ELSE NULL END) AS sales_close,

    
        (COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 
            AND nl.label_s NOT IN (2, 11, 46, 80, 81) 
            AND nl.label_s NOT IN (SELECT id FROM nano_label WHERE category = 'Unable To Do')
            AND nl.label_s NOT IN (SELECT id FROM nano_label WHERE category = 'Follow Up') 
        THEN 1 ELSE NULL END) - 
        COUNT(DISTINCT CASE WHEN nso.lead_id = nl.id AND CAST(nso.created_date AS BIGINT) BETWEEN CAST($1 AS BIGINT) AND CAST($2 AS BIGINT) THEN nso.created_date ELSE NULL END)
        ) AS adjusted_other

      FROM nano_leads nl
      LEFT JOIN (
        SELECT lead_id, MAX(CAST(created_date AS BIGINT)) AS created_date
        FROM nano_sales_order
        GROUP BY lead_id
      ) nso ON nso.lead_id = nl.id
      LEFT JOIN nano_sales ns ON ns.lead_id = nl.id  
    `;

    // Calculate the date ranges
    const startOfSelectedPeriod = parseInt(startdate); // Passed start date as timestamp
    const endOfSelectedPeriod = parseInt(enddate); // Passed end date as timestamp
    const startOfLastPeriod = new Date(new Date(startOfSelectedPeriod).setMonth(new Date(startOfSelectedPeriod).getMonth() - 1)).getTime();
    const endOfLastPeriod = new Date(new Date(endOfSelectedPeriod).setMonth(new Date(endOfSelectedPeriod).getMonth() - 1)).getTime();
    const startOfYear = new Date(selectyear, 0, 1).getTime();
    const endOfYear = new Date(selectyear, 11, 31, 23, 59, 59).getTime();
    const startOfLastYear = new Date(selectyear - 1, 0, 1).getTime();
    const endOfLastYear = new Date(selectyear - 1, 11, 31, 23, 59, 59).getTime();

    // Execute the query with the dynamic parameters
    client
      .query(query, [
        startOfSelectedPeriod, endOfSelectedPeriod, // Selected Period
        startOfLastPeriod, endOfLastPeriod,         // Last Period
        startOfYear, endOfYear,                     // This Year
        startOfLastYear, endOfLastYear              // Last Year
      ])
      .then((result) => {
        release();
        return res.status(200).send({ data: result.rows, success: true });
      })
      .catch((error) => {
        release();
        console.log(error);
        return res.status(800).send({ success: false });
      });
  });
});

app.post('/getOverviewSc', async (req, res) => {
  console.log('getOverviewSc');

  const { selectyear, startdate, enddate, salesco } = req.body;

  pool.connect((err, client, release) => {
    if (err) {
      release();
      return res.status(200).send({ success: false });
    }

    const query = `
      SELECT 
        COUNT(*) AS all,
        COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 THEN 1 ELSE NULL END) AS selected_period,
        COUNT(CASE WHEN nl.created_date BETWEEN $3 AND $4 THEN 1 ELSE NULL END) AS last_period,
        COUNT(CASE WHEN nl.created_date BETWEEN $5 AND $6 THEN 1 ELSE NULL END) AS this_year,
        COUNT(CASE WHEN nl.created_date BETWEEN $7 AND $8 THEN 1 ELSE NULL END) AS last_year,
        COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 AND nl.label_s = 2 THEN 1 ELSE NULL END) AS to_follow,
        COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 AND nl.label_s IN (11, 46) THEN 1 ELSE NULL END) AS attending,
        COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 AND nl.label_s IN (80, 81) THEN 1 ELSE NULL END) AS cancel_reschedule,
        COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 AND nl.label_s IN (SELECT id FROM nano_label 
          WHERE category = 'Unable To Do') 
        THEN 1 ELSE NULL END) AS unable,
        COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 AND nl.label_s IN (SELECT id FROM nano_label WHERE category = 'Follow Up') 
        THEN 1 ELSE NULL END) AS followed,
        COUNT(DISTINCT CASE WHEN nso.lead_id = nl.id AND CAST(nso.created_date AS BIGINT) BETWEEN CAST($1 AS BIGINT) AND CAST($2 AS BIGINT) THEN nso.created_date ELSE NULL END) AS sales_close,
        
        (COUNT(CASE WHEN nl.created_date BETWEEN $1 AND $2 
            AND nl.label_s NOT IN (2, 11, 46, 80, 81) 
            AND nl.label_s NOT IN (SELECT id FROM nano_label WHERE category = 'Unable To Do')
            AND nl.label_s NOT IN (SELECT id FROM nano_label WHERE category = 'Follow Up') 
        THEN 1 ELSE NULL END) - 
        COUNT(DISTINCT CASE WHEN nso.lead_id = nl.id AND CAST(nso.created_date AS BIGINT) BETWEEN CAST($1 AS BIGINT) AND CAST($2 AS BIGINT) THEN nso.created_date ELSE NULL END)
        ) AS adjusted_other

      FROM nano_leads nl
      LEFT JOIN (
        SELECT lead_id, MAX(CAST(created_date AS BIGINT)) AS created_date
        FROM nano_sales_order
        GROUP BY lead_id
      ) nso ON nso.lead_id = nl.id
      LEFT JOIN nano_sales ns ON ns.lead_id = nl.id  
      WHERE nl.sales_coordinator = $9
    `;

    // Calculate the date ranges
    const startOfSelectedPeriod = parseInt(startdate); // Passed start date as timestamp
    const endOfSelectedPeriod = parseInt(enddate); // Passed end date as timestamp
    const startOfLastPeriod = new Date(new Date(startOfSelectedPeriod).setMonth(new Date(startOfSelectedPeriod).getMonth() - 1)).getTime();
    const endOfLastPeriod = new Date(new Date(endOfSelectedPeriod).setMonth(new Date(endOfSelectedPeriod).getMonth() - 1)).getTime();
    const startOfYear = new Date(selectyear, 0, 1).getTime();
    const endOfYear = new Date(selectyear, 11, 31, 23, 59, 59).getTime();
    const startOfLastYear = new Date(selectyear - 1, 0, 1).getTime();
    const endOfLastYear = new Date(selectyear - 1, 11, 31, 23, 59, 59).getTime();

    // Execute the query with the dynamic parameters
    client
      .query(query, [
        startOfSelectedPeriod, endOfSelectedPeriod, // Selected Period
        startOfLastPeriod, endOfLastPeriod,         // Last Period
        startOfYear, endOfYear,                     // This Year
        startOfLastYear, endOfLastYear,             // Last Year
        salesco                                     // Sales Coordinator UID
      ])
      .then((result) => {
        release();
        return res.status(200).send({ data: result.rows, success: true });
      })
      .catch((error) => {
        release();
        console.log(error);
        return res.status(500).send({ success: false });
      });
  });
});

app.post('/getOverviewSe', async (req, res) => {
  console.log('getOverviewSe');

  const { selectyear, startdate, enddate, salesex } = req.body;

  pool.connect((err, client, release) => {
    if (err) {
      release();
      return res.status(200).send({ success: false });
    }

    const query = `
      SELECT 
        COUNT(*) AS all,
        COUNT(CASE WHEN na.appointment_time BETWEEN $1 AND $2 THEN 1 ELSE NULL END) AS selected_period,
        COUNT(CASE WHEN na.appointment_time BETWEEN $3 AND $4 THEN 1 ELSE NULL END) AS last_period,
        COUNT(CASE WHEN na.appointment_time BETWEEN $5 AND $6 THEN 1 ELSE NULL END) AS this_year,
        COUNT(CASE WHEN na.appointment_time BETWEEN $7 AND $8 THEN 1 ELSE NULL END) AS last_year,
        COUNT(CASE WHEN na.appointment_time BETWEEN $1 AND $2 AND nl.label_s IN (11) THEN 1 ELSE NULL END) AS attending,
        COUNT(CASE WHEN na.appointment_time BETWEEN $1 AND $2 AND nl.label_s IN (46) THEN 1 ELSE NULL END) AS attended,
        COUNT(CASE WHEN na.appointment_time BETWEEN $1 AND $2 AND nl.label_s IN (80, 81) THEN 1 ELSE NULL END) AS cancel_reschedule,
        COUNT(CASE WHEN na.appointment_time BETWEEN $1 AND $2 AND nl.label_s IN (SELECT id FROM nano_label 
          WHERE category = 'Unable To Do') 
        THEN 1 ELSE NULL END) AS unable,
        COUNT(DISTINCT CASE WHEN nso.lead_id = nl.id AND CAST(nso.created_date AS BIGINT) BETWEEN CAST($1 AS BIGINT) AND CAST($2 AS BIGINT) THEN nso.created_date ELSE NULL END) AS sales_close,
        
        (COUNT(CASE WHEN na.appointment_time BETWEEN $1 AND $2 
            AND nl.label_s NOT IN (11, 46, 80, 81) 
            AND nl.label_s NOT IN (SELECT id FROM nano_label WHERE category = 'Unable To Do')
        THEN 1 ELSE NULL END) - 
        COUNT(DISTINCT CASE WHEN nso.lead_id = nl.id AND CAST(nso.created_date AS BIGINT) BETWEEN CAST($1 AS BIGINT) AND CAST($2 AS BIGINT) THEN nso.created_date ELSE NULL END)
        ) AS adjusted_other

      FROM nano_appointment na
      LEFT JOIN nano_leads nl ON nl.id = na.lead_id
      LEFT JOIN (
        SELECT lead_id, MAX(CAST(created_date AS BIGINT)) AS created_date
        FROM nano_sales_order
        GROUP BY lead_id
      ) nso ON nso.lead_id = nl.id
      LEFT JOIN nano_sales ns ON ns.lead_id = nl.id  
      WHERE $9 = ANY(SELECT jsonb_array_elements_text(na.assigned_to4::jsonb))
      `;

    // Calculate the date ranges
    const startOfSelectedPeriod = parseInt(startdate); // Passed start date as timestamp
    const endOfSelectedPeriod = parseInt(enddate); // Passed end date as timestamp
    const startOfLastPeriod = new Date(new Date(startOfSelectedPeriod).setMonth(new Date(startOfSelectedPeriod).getMonth() - 1)).getTime();
    const endOfLastPeriod = new Date(new Date(endOfSelectedPeriod).setMonth(new Date(endOfSelectedPeriod).getMonth() - 1)).getTime();
    const startOfYear = new Date(selectyear, 0, 1).getTime();
    const endOfYear = new Date(selectyear, 11, 31, 23, 59, 59).getTime();
    const startOfLastYear = new Date(selectyear - 1, 0, 1).getTime();
    const endOfLastYear = new Date(selectyear - 1, 11, 31, 23, 59, 59).getTime();

    // Execute the query with the dynamic parameters
    client
      .query(query, [
        startOfSelectedPeriod, endOfSelectedPeriod, // Selected Period
        startOfLastPeriod, endOfLastPeriod,         // Last Period
        startOfYear, endOfYear,                     // This Year
        startOfLastYear, endOfLastYear,             // Last Year
        salesex                                     // Sales Executive UID
      ])
      .then((result) => {
        release();
        return res.status(200).send({ data: result.rows, success: true });
      })
      .catch((error) => {
        release();
        console.log(error);
        return res.status(500).send({ success: false });
      });
  });
});

app.post('/getAdsChannelCount', async (req, res) => {
  console.log('getAdsChannelCount');

  const { month, year } = req.body;
  if (!month || !year) {
    return res.status(400).send({ success: false, message: 'Month and Year are required' });
  }

  const monthIndex = parseInt(month, 10) - 1;
  const yearInt = parseInt(year, 10);
  const daysInMonth = new Date(yearInt, monthIndex + 1, 0).getDate();

  // Calculate the end days for each period
  const range1End = Math.ceil(daysInMonth / 3); // 1st to 1/3 of the month
  const range2End = Math.ceil((daysInMonth * 2) / 3); // 1st to 2/3 of the month
  const range3End = daysInMonth; // 1st to the last day of the month

  // Define the three ranges
  const ranges = [
    { start: new Date(yearInt, monthIndex, 1).getTime(), end: new Date(yearInt, monthIndex, range1End, 23, 59, 59).getTime() },
    { start: new Date(yearInt, monthIndex, 1).getTime(), end: new Date(yearInt, monthIndex, range2End, 23, 59, 59).getTime() },
    { start: new Date(yearInt, monthIndex, 1).getTime(), end: new Date(yearInt, monthIndex, range3End, 23, 59, 59).getTime() }
  ];

  pool.connect((err, client, release) => {
    if (err) {
      release();
      return res.status(500).send({ success: false, message: 'Database connection error' });
    }

    const query = `
    SELECT 
      nl.ads_id AS reference,
      COUNT(*) AS total,
      SUM(CASE WHEN nl.label_m = 55 THEN 1 ELSE 0 END) AS appt,
      ROUND((SUM(CASE WHEN nl.label_m = 55 THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 2) AS rate,
      CASE 
        WHEN nl.created_date BETWEEN $1 AND $2 THEN 1 
        WHEN nl.created_date BETWEEN $1 AND $3 THEN 2 
        WHEN nl.created_date BETWEEN $1 AND $4 THEN 3 
        ELSE NULL
      END AS period
    FROM nano_leads nl
    WHERE nl.ads_id IS NOT NULL AND nl.ads_id != ''
    GROUP BY nl.ads_id, period
    ORDER BY period ASC, total DESC;
    `;

    client.query(query, [
      ranges[0].start, ranges[0].end, // Range 1: First period
      ranges[1].end, // Range 2: Second period
      ranges[2].end  // Range 3: Full month
    ]).then((result) => {
      release();

      // Prepare the grouped results for each period
      const groupedResults = [{}, {}, {}];
      result.rows.forEach((row) => {
        if (row.period) {
          const periodIndex = row.period - 1;

          // Ensure the reference exists for the period, if not initialize it
          if (!groupedResults[periodIndex][row.reference]) {
            groupedResults[periodIndex][row.reference] = { total: 0, appt: 0, rate: 0 };
          }

          // Add the current period's total to the period's reference
          groupedResults[periodIndex][row.reference].total += row.total;
          groupedResults[periodIndex][row.reference].appt += row.appt;

          // Recalculate the rate for the current period's accumulated data
          groupedResults[periodIndex][row.reference].rate = groupedResults[periodIndex][row.reference].total > 0
            ? Math.ceil((groupedResults[periodIndex][row.reference].appt / groupedResults[periodIndex][row.reference].total) * 100)
            : 0;
        }
      });

      // Accumulate data across periods correctly
      for (let i = 1; i < groupedResults.length; i++) {
        Object.keys(groupedResults[i - 1]).forEach((reference) => {
          if (!groupedResults[i][reference]) {
            groupedResults[i][reference] = { total: 0, appt: 0, rate: 0 };
          }

          // Accumulate previous period's totals
          groupedResults[i][reference].total += groupedResults[i - 1][reference].total;
          groupedResults[i][reference].appt += groupedResults[i - 1][reference].appt;

          // Recalculate rate after accumulation
          groupedResults[i][reference].rate = groupedResults[i][reference].total > 0
            ? Math.ceil((groupedResults[i][reference].appt / groupedResults[i][reference].total) * 100)
            : 0;
        });
      }

      // Sort by Period 3's total
      const sortedReferences = Object.keys(groupedResults[2]).sort((a, b) => {
        return groupedResults[2][b].total - groupedResults[2][a].total;
      });

      // Reorder groupedResults based on sorted references
      const sortedResults = groupedResults.map(period => {
        let sortedPeriod = {};
        sortedReferences.forEach(ref => {
          sortedPeriod[ref] = period[ref];
        });
        return sortedPeriod;
      });

      // Return sorted results
      return res.status(200).send({ data: sortedResults, success: true });

    }).catch((error) => {
      release();
      console.log(error);
      return res.status(500).send({ success: false, message: 'Query error' });
    });
  });
});

app.post('/getFinanceOverview', async (req, res) => {
  console.log('getFinanceOverview');

  const { startdate, enddate } = req.body;

  pool.connect((err, client, release) => {
    if (err) {
      release();
      return res.status(200).send({ success: false });
    }

    const query = `
      SELECT 
        TO_CHAR(TO_TIMESTAMP(CAST(payment_date AS BIGINT) / 1000), 'YYYY-MM-DD') AS payment_day,
        SUM(total) AS total_payment
      FROM nano_payment_log
      WHERE payment_date BETWEEN $1 AND $2
      GROUP BY payment_day
      ORDER BY payment_day;
    `;

    // Execute the query with the dynamic parameters
    client
      .query(query, [startdate, enddate])
      .then((result) => {
        release();
        return res.status(200).send({ data: result.rows, success: true });
      })
      .catch((error) => {
        release();
        console.log(error);
        return res.status(800).send({ success: false });
      });
  });
});

app.post('/getFinanceOverview2', async (req, res) => {
  console.log('getFinanceOverview2');

  const { startdate, enddate, filter } = req.body;

  pool.connect((err, client, release) => {
    if (err) {
      release();
      return res.status(200).send({ success: false });
    }

    let query = `
      SELECT 
        TO_CHAR(TO_TIMESTAMP(CAST(p.payment_date AS BIGINT) / 1000), 'YYYY-MM-DD') AS payment_day,
        SUM(p.total) AS total_payment
      FROM nano_payment_log p
    `;

    if (filter === 'full') {
      query += `
        JOIN nano_sales s ON p.sales_id = s.id
        WHERE p.payment_date BETWEEN $1 AND $2 AND s.payment_status = 'Completed'
      `;
    } else if (filter === 'deposit') {
      query += `
        JOIN nano_sales s ON p.sales_id = s.id
        WHERE p.payment_date BETWEEN $1 AND $2 AND s.payment_status = 'Pending'
      `;
    } else {
      // default to 'all'
      query += `
        WHERE p.payment_date BETWEEN $1 AND $2
      `;
    }

    query += `
      GROUP BY payment_day
      ORDER BY payment_day;
    `;

    client
      .query(query, [startdate, enddate])
      .then((result) => {
        release();
        return res.status(200).send({ data: result.rows, success: true });
      })
      .catch((error) => {
        release();
        console.error(error);
        return res.status(800).send({ success: false });
      });
  });
});


app.post('/getPaymentGatewayOverview', async (req, res) => {
  console.log('getPaymentGatewayOverview');

  const { startdate, enddate } = req.body;

  pool.connect((err, client, release) => {
    if (err) {
      release();
      return res.status(200).send({ success: false });
    }

    const query = `
      WITH gateway_totals AS (
        SELECT 
          gateway,
          COUNT(*) AS usage_count,      -- Count how many times each gateway was used
          SUM(total) AS total_payment
        FROM nano_payment_log
        WHERE payment_date BETWEEN $1 AND $2
        GROUP BY gateway
      ), 
      overall_totals AS (
        SELECT 
          SUM(usage_count) AS total_usage, 
          SUM(total_payment) AS total_all
        FROM gateway_totals
      )
      SELECT 
        g.gateway,
        g.usage_count,  
        g.total_payment,
        ROUND((g.usage_count::decimal / o.total_usage) * 100, 2) AS usage_percentage  -- Calculate usage percentage based on count
      FROM gateway_totals g, overall_totals o
      ORDER BY g.usage_count DESC;
    `;

    client
      .query(query, [startdate, enddate])
      .then((result) => {
        release();
        return res.status(200).send({ data: result.rows, success: true });
      })
      .catch((error) => {
        release();
        console.log(error);
        return res.status(500).send({ success: false });
      });
  });
});

app.post('/getLeadsByMonthAndYear', async (req, res) => {
  console.log('getLeadsByMonthAndYear');

  const { month, year } = req.body;
  if (!month || !year) {
    return res.status(400).send({ success: false, message: 'Month and Year are required' });
  }

  const monthInt = parseInt(month, 10);
  const yearInt = parseInt(year, 10);

  // Calculate the start and end dates for the month
  const startDate = new Date(yearInt, monthInt - 1, 1);
  const endDate = new Date(yearInt, monthInt, 0);
  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime() + 86399000;

  pool.connect((err, client, release) => {
    if (err) {
      release();
      return res.status(500).send({ success: false, message: 'Database connection error' });
    }

    const baseTime = "to_timestamp(CAST(created_date AS bigint) / 1000)";

    const dailyQuery = `
      SELECT 
        to_char(${baseTime}, 'YYYY-MM-DD') AS lead_date,
        COUNT(*) AS total_leads
      FROM nano_leads
      WHERE created_date BETWEEN $1 AND $2
      GROUP BY lead_date
      ORDER BY lead_date;
    `;

    const annualQuery = `
      SELECT 
        TO_CHAR(${baseTime}, 'Month') AS month_name,
        EXTRACT(MONTH FROM ${baseTime}) AS month_number,
        COUNT(*) AS total_leads
      FROM nano_leads
      WHERE EXTRACT(YEAR FROM ${baseTime}) = $1
      GROUP BY month_name, month_number
      ORDER BY month_number;
    `;

    Promise.all([
      client.query(dailyQuery, [startTimestamp, endTimestamp]),
      client.query(annualQuery, [yearInt])
    ])
      .then(([dailyResult, annualResult]) => {
        release();

        const annualData = annualResult.rows.map(row => ({
          month_name: row.month_name.trim(),
          month_number: row.month_number,
          total_leads: row.total_leads
        }));

        return res.status(200).send({
          success: true,
          daily_data: dailyResult.rows,
          annual_data: annualData
        });
      })
      .catch(error => {
        release();
        console.log(error);
        return res.status(500).send({ success: false, message: 'Query error' });
      });
  });
});

app.post('/getAppointmentsByMonthAndYear', async (req, res) => {
  console.log('getAppointmentsByMonthAndYear');

  const { month, year } = req.body;
  if (!month || !year) {
    return res.status(400).send({ success: false, message: 'Month and Year are required' });
  }

  const monthInt = parseInt(month, 10);
  const yearInt = parseInt(year, 10);

  // Calculate the start and end timestamps for the month
  const startDate = new Date(yearInt, monthInt - 1, 1);
  const endDate = new Date(yearInt, monthInt, 0);
  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime() + 86399000; // Add 23:59:59 in milliseconds

  pool.connect((err, client, release) => {
    if (err) {
      release();
      return res.status(500).send({ success: false, message: 'Database connection error' });
    }

    const baseTime = "to_timestamp(CAST(a.appointment_time AS bigint) / 1000)";

    const dailyQuery = `
      SELECT 
        TO_CHAR(${baseTime}, 'YYYY-MM-DD') AS appointment_date,
        COUNT(*) AS total_appointments
      FROM nano_leads l
      JOIN nano_appointment a ON a.lead_id = l.id
      WHERE 
        l.label_m = 55 AND
        a.appointment_time BETWEEN $1 AND $2
      GROUP BY appointment_date
      ORDER BY appointment_date;
    `;

    const annualQuery = `
      SELECT 
        TO_CHAR(${baseTime}, 'Month') AS month_name,
        EXTRACT(MONTH FROM ${baseTime}) AS month_number,
        COUNT(*) AS total_appointments
      FROM nano_leads l
      JOIN nano_appointment a ON a.lead_id = l.id
      WHERE 
        l.label_m = 55 AND
        EXTRACT(YEAR FROM ${baseTime}) = $1
      GROUP BY month_name, month_number
      ORDER BY month_number;
    `;

    Promise.all([
      client.query(dailyQuery, [startTimestamp, endTimestamp]),
      client.query(annualQuery, [yearInt])
    ])
      .then(([dailyResult, annualResult]) => {
        release();

        const annualData = annualResult.rows.map(row => ({
          month_name: row.month_name.trim(),
          month_number: row.month_number,
          total_appointments: row.total_appointments
        }));

        return res.status(200).send({
          success: true,
          daily_data: dailyResult.rows,
          annual_data: annualData
        });
      })
      .catch(error => {
        release();
        console.log(error);
        return res.status(500).send({ success: false, message: 'Query error' });
      });
  });
});

app.post('/getSalesByMonthAndYear', async (req, res) => {
  console.log('getSalesByMonthAndYear');

  const { month, year } = req.body;
  if (!month || !year) {
    return res.status(400).send({ success: false, message: 'Month and Year are required' });
  }

  const monthInt = parseInt(month, 10);
  const yearInt = parseInt(year, 10);

  // Calculate the start and end timestamps for the month
  const startDate = new Date(yearInt, monthInt - 1, 1);
  const endDate = new Date(yearInt, monthInt, 0);
  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime() + 86399000; // Add 23:59:59 in milliseconds

  pool.connect((err, client, release) => {
    if (err) {
      release();
      return res.status(500).send({ success: false, message: 'Database connection error' });
    }

    const cte = `
      WITH earliest_sales_order AS (
        SELECT DISTINCT ON (nso.lead_id)
          nso.lead_id,
          nso.created_date AS sales_timestamp,
          to_timestamp(nso.created_date::bigint / 1000) AS sales_time
        FROM nano_sales_order nso
        ORDER BY nso.lead_id, nso.created_date
      )
    `;

    const dailyQuery = `
      ${cte}
      SELECT 
        TO_CHAR(eso.sales_time, 'YYYY-MM-DD') AS sales_date,
        COUNT(*) AS total_sales
      FROM nano_leads l
      JOIN nano_sales s ON s.lead_id = l.id
      JOIN earliest_sales_order eso ON eso.lead_id = s.lead_id
      WHERE 
        l.label_s = 47 AND
        eso.sales_timestamp BETWEEN $1 AND $2
      GROUP BY sales_date
      ORDER BY sales_date;
    `;

    const annualQuery = `
      ${cte}
      SELECT 
        TO_CHAR(eso.sales_time, 'Month') AS month_name,
        EXTRACT(MONTH FROM eso.sales_time) AS month_number,
        COUNT(*) AS total_sales
      FROM nano_leads l
      JOIN nano_sales s ON s.lead_id = l.id
      JOIN earliest_sales_order eso ON eso.lead_id = s.lead_id
      WHERE 
        l.label_s = 47 AND
        EXTRACT(YEAR FROM eso.sales_time) = $1
      GROUP BY month_name, month_number
      ORDER BY month_number;
    `;

    Promise.all([
      client.query(dailyQuery, [startTimestamp, endTimestamp]),
      client.query(annualQuery, [yearInt])
    ])
      .then(([dailyResult, annualResult]) => {
        release();

        const annualData = annualResult.rows.map(row => ({
          month_name: row.month_name.trim(),
          month_number: row.month_number,
          total_sales: parseInt(row.total_sales, 10)
        }));

        return res.status(200).send({
          success: true,
          daily_data: dailyResult.rows,
          annual_data: annualData
        });
      })
      .catch(error => {
        release();
        console.log(error);
        return res.status(500).send({ success: false, message: 'Query error' });
      });
  });
});


app.post('/getWorkerSummary', async (req, res) => {
  const { startdate, enddate } = req.body;

  const startTime = parseInt(startdate);
  const endTime = parseInt(enddate);

  pool.connect((err, client, release) => {
    if (err) {
      release();
      return res.status(500).send({ success: false, message: 'Connection error' });
    }

    const query = `
    WITH 
    -- Filtered Appointments
    filtered_appointments AS (
      SELECT 
        na.id AS appointment_id,
        na.lead_id,
        jsonb_array_elements_text(na.assigned_to4::jsonb) AS worker_uid
      FROM nano_appointment na
      WHERE na.appointment_time::BIGINT BETWEEN $1 AND $2
    ),

    -- All Appointments
    all_appointments AS (
      SELECT 
        na.lead_id,
        jsonb_array_elements_text(na.assigned_to4::jsonb) AS worker_uid
      FROM nano_appointment na
      WHERE na.assigned_to4 IS NOT NULL
    ),

    -- Filtered Sales
    filtered_sales AS (
      SELECT *
      FROM nano_sales_order
      WHERE created_date::BIGINT BETWEEN $1 AND $2
    ),

    -- Sales mapped to worker
    sales_by_worker AS (
      SELECT DISTINCT 
        fa.worker_uid,
        fs.id AS sales_id,
        fs.lead_id
      FROM filtered_sales fs
      JOIN all_appointments fa ON fa.lead_id = fs.lead_id
    ),

    -- Revenue per worker (updated)
    payment_totals AS (
      SELECT 
        p.created_by AS worker_uid,
        SUM(p.total) AS revenue
      FROM nano_payment_log p
      WHERE p.payment_date::BIGINT BETWEEN $1 AND $2
      GROUP BY p.created_by
    ),

    -- Attendance Status
    latest_check_status AS (
      SELECT 
        appointment_id,
        while_check_status,
        ROW_NUMBER() OVER (PARTITION BY appointment_id ORDER BY check_time DESC) AS rn
      FROM nano_check
    ),

    -- Appointment Stats
    appointment_stats AS (
      SELECT
        fa.worker_uid,
        fa.appointment_id,
        na.kiv,
        nl.label_s,
        CASE
          WHEN lcs.while_check_status LIKE 'late%' THEN 'late'
          WHEN lcs.while_check_status LIKE 'early%' THEN 'early'
          ELSE 'no_check'
        END AS attendance_status,
        CASE WHEN na.kiv IS TRUE THEN true ELSE false END AS is_kiv,
        CASE WHEN nl.label_s = 81 THEN true ELSE false END AS is_reschedule,
        CASE WHEN nl.label_s = 80 THEN true ELSE false END AS is_cancelled
      FROM filtered_appointments fa
      LEFT JOIN nano_appointment na ON fa.appointment_id = na.id
      LEFT JOIN nano_leads nl ON nl.id = fa.lead_id
      LEFT JOIN latest_check_status lcs 
        ON lcs.appointment_id = fa.appointment_id AND lcs.rn = 1
    )

    SELECT 
      u.uid,
      u.user_id,
      u.user_name AS name,

      COUNT(DISTINCT fa.appointment_id) AS appt,
      COUNT(DISTINCT sbw.lead_id) AS sales,

      COUNT(DISTINCT CASE WHEN nl.conditional_status = 'Video Interview' THEN nl.id END) AS video,
      COUNT(DISTINCT CASE WHEN nl.conditional_status = 'FB like & Share & Google Review' THEN nl.id END) AS review,

      COUNT(DISTINCT CASE WHEN aps.attendance_status = 'late' THEN fa.appointment_id END) AS late_attendance,
      COUNT(DISTINCT CASE WHEN aps.attendance_status = 'early' THEN fa.appointment_id END) AS early_attendance,
      COUNT(DISTINCT CASE WHEN aps.attendance_status = 'no_check' THEN fa.appointment_id END) AS no_check_attendance,

      COUNT(DISTINCT CASE WHEN aps.is_kiv THEN fa.appointment_id END) AS no_check_kiv,
      COUNT(DISTINCT CASE WHEN aps.is_reschedule THEN fa.appointment_id END) AS no_check_reschedule,
      COUNT(DISTINCT CASE WHEN aps.is_cancelled THEN fa.appointment_id END) AS no_check_cancelled,
      COUNT(DISTINCT CASE 
        WHEN aps.attendance_status = 'no_check'
          AND NOT aps.is_kiv
          AND NOT aps.is_reschedule
          AND NOT aps.is_cancelled
        THEN fa.appointment_id
      END) AS no_check_others,

      COALESCE(pt.revenue, 0) AS revenue

    FROM nano_user u
    LEFT JOIN filtered_appointments fa ON fa.worker_uid = u.uid
    LEFT JOIN nano_leads nl ON nl.id = fa.lead_id
    LEFT JOIN sales_by_worker sbw ON sbw.worker_uid = u.uid
    LEFT JOIN appointment_stats aps ON aps.worker_uid = u.uid AND aps.appointment_id = fa.appointment_id
    LEFT JOIN payment_totals pt ON pt.worker_uid = u.uid

    WHERE u.status IS DISTINCT FROM false
      AND u.user_role = 'Sales Executive'
      AND u.uid != 'LbdDaz3w3yPFVjTEQVr6PbGP3PC3'

    GROUP BY u.uid, u.user_id, u.user_name, pt.revenue
    ORDER BY u.user_id;
    `;

    client.query(query, [startTime, endTime])
      .then((result) => {
        release();
        return res.status(200).send({ success: true, data: result.rows });
      })
      .catch((error) => {
        release();
        console.error(error);
        return res.status(500).send({ success: false });
      });
  });
});







app.get('/getAllLeadList', async (req, res) => {
  console.log('getAllLeadList')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }

    client.query(`
      WITH selected AS (
        SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, 
          nl.warranty_id, nc.no AS check_details, COALESCE(EXTRACT(epoch from nl.created_date::date) * 1000, nl.created_date::bigint) AS created_date, 
          (SELECT created_date FROM nano_sales WHERE appointment_id = nat.id LIMIT 1) AS appoint_date,
          CASE WHEN nl.customer_phone IS NULL THEN 0 ELSE row_number() OVER (PARTITION BY nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
          END AS phone_row_number, nls.status AS whole_status, nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified, nl.address, 
          nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues, nl.status AS lead_status, nl.ads_id, nl.channel_id, nat.appointment_status, nls.payment_status, 
          nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to, nat.checkin, nat.kiv,
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
          (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
          nls.subcon_state, nls.finance_check, nls.finance_remark, 
          (CASE
            WHEN (nls.gen_quotation::TEXT = '[]' OR nls.gen_quotation IS NULL) AND 
                 (nls.custom_quotation::TEXT = '[]' OR nls.custom_quotation IS NULL) 
            THEN false 
            ELSE true 
          END) AS got_quotation,
          (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category, nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
        FROM nano_leads nl 
        LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id 
        LEFT JOIN nano_user u1 ON nl.created_by = u1.uid 
        LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
        LEFT JOIN nano_label nla ON nl.label_m = nla.id 
        LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id 
        LEFT JOIN nano_sales nls ON nat.id = nls.appointment_id 
        LEFT JOIN nano_check nc ON nc.appointment_id = nat.id 
        ORDER BY lead_id
      )
      SELECT DISTINCT ON (s.lead_id) s.*, 
             (SELECT created_date AS sof_latest_created_date 
              FROM nano_sales_order nso 
              WHERE nso.lead_id = s.lead_id 
              ORDER BY nso.created_date LIMIT 1) AS sof_latest_created_date
      FROM selected s
      ORDER BY s.lead_id;
    `).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })
    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    })
  })
})



app.post('/getLeadList3', async (req, res) => {
  console.log('getLeadList3')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }

    client.query(`WITH selected AS (
            SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour,
             nl.warranty_id,
              (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
              (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
              ELSE nl.created_date::bigint end) AS created_date,
              (SELECT created_date FROM nano_sales WHERE appointment_id = nat.id LIMIT 1) AS appoint_date,
              CASE 
              WHEN nl.customer_phone IS NULL THEN 0
              ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
              END as phone_row_number,
              CASE 
              WHEN nl.address IS NULL THEN 0
              ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
              END as address_row_number,
              nls.status AS whole_status,
              nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
                nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
                nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to, nat.checkin, nls.final_approval,
                (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid,
                (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
                (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
                nls.subcon_state, nls.finance_check, nls.finance_remark, 
                (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
                nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
                  FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
                LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
                nano_sales nls ON nat.id = nls.appointment_id 
              ) SELECT * FROM selected WHERE  ((created_date::bigint) > $1 AND (created_date::bigint) < $2)`, [req.body.startDate, req.body.endDate]
    ).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    })

  })

})

app.post('/getLeadListMarketing', async (req, res) => {
  console.log('getLeadListMarketing')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }

    client.query(`
    WITH selected AS (
      SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, 
             nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
             COALESCE(
                 (SELECT EXTRACT(epoch from created_date::date) * 1000 
                  FROM nano_leads WHERE id = nl.id AND created_date LIKE '%-%'),
                 nl.created_date::bigint
             ) AS created_date,
             ROW_NUMBER() OVER (PARTITION BY nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST) AS phone_row_number,
             ROW_NUMBER() OVER (PARTITION BY nl.address ORDER BY nl.created_date ASC NULLS LAST) AS address_row_number,
             nls.status AS whole_status,
             nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.mkt_created, 
             nl.customer_state, nl.verified, nl.mkt_inspect, nl.mkt_install, nl.mkt_inspect_log, 
             nl.mkt_install_log, nl.address, nl.company_address, nl.saleexec_note, 
             nl.remark, nl.services, nl.issues, nl.status AS lead_status, nl.ads_id, 
             nl.channel_id, nat.kiv, nat.appointment_status, nat.appointment_time, 
             nls.payment_status, nls.total AS payment_total, nls.sales_status, 
             nat.assigned_to4, nat.assigned_to, nat.checkin, nls.final_approval,
             (SELECT SUM(total) 
              FROM nano_payment_log 
              WHERE sales_id = nls.id) AS total_paid,
             (SELECT id 
              FROM nano_sales 
              WHERE id = nls.id AND total = 
                    (SELECT SUM(total) 
                     FROM nano_payment_log 
                     WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid,
             nls.subcon_state, nls.finance_check, nls.finance_remark, nls.id AS sales_id,
             (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
             nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
      FROM nano_leads nl 
      LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id 
      LEFT JOIN nano_user u1 ON nl.created_by = u1.uid 
      LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
      LEFT JOIN nano_label nla ON nl.label_m = nla.id 
      LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id 
      LEFT JOIN nano_sales nls ON nat.id = nls.appointment_id
      WHERE 
          nl.created_date::bigint > $1 AND 
          nl.created_date::bigint < $2 AND
          (nl.mkt_inspect IS TRUE OR nl.mkt_install IS TRUE OR nl.mkt_created IS TRUE)
  ), 
  sales_packages AS (
      SELECT 
          sales_id,
          jsonb_agg(row_to_json(sp)::jsonb) AS sales_packages
      FROM nano_sales_package sp
      GROUP BY sales_id
  )
  SELECT 
      s.*,
      sp.sales_packages
  FROM selected s
  LEFT JOIN sales_packages sp ON s.sales_id = sp.sales_id;
      `, [req.body.startDate, req.body.endDate]
    ).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    });
  });
});

app.post('/getMarketingLeads', async (req, res) => {
  console.log('getMarketingLeads')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }

    client.query(`
      WITH sales_packages AS (
          SELECT 
              sales_id,
              jsonb_agg(row_to_json(sp)::jsonb) AS sales_packages
          FROM nano_sales_package sp
          GROUP BY sales_id
      )
      SELECT 
          nl.*,
          na.appointment_time,
          sp.sales_packages
      FROM nano_leads nl
      LEFT JOIN nano_appointment na ON nl.id = na.lead_id
      LEFT JOIN nano_sales ns ON na.id = ns.appointment_id
      LEFT JOIN sales_packages sp ON ns.id = sp.sales_id
      WHERE nl.inspect_date IS NOT NULL
      AND nl.created_date::bigint > $1 
      AND nl.created_date::bigint < $2
    `, [req.body.startDate, req.body.endDate]
    ).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    });
  });
});

app.get('/getLeadList3ForQuotationRequest', async (req, res) => {
  console.log('getLeadList3ForQuotationRequest')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }


    client.query(`WITH selected AS (
            SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour,
             nl.warranty_id,
              (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
              (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
              ELSE nl.created_date::bigint end) AS created_date,
              CASE 
              WHEN nl.customer_phone IS NULL THEN 0
              ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
              END as phone_row_number,
              CASE 
              WHEN nl.address IS NULL THEN 0
              ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
              END as address_row_number,
              nls.status AS whole_status,
              nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
                nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
                nls.total AS payment_total, nls.sales_status, nls.quotation_request, nls.quotation_request_date, nls.quotation_submit_date, nat.assigned_to4, nat.assigned_to, nat.checkin,
                (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
                (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
                (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
                nls.subcon_state, nls.finance_check, nls.finance_remark, 
                (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
                nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
                FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
                LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
                nano_sales nls ON nat.id = nls.appointment_id 
              ) SELECT * FROM selected WHERE quotation_request = true`
    ).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    })

  })

})

app.get('/getLeadList3ForQuotationRequest2', async (req, res) => {
  console.log('getLeadList3ForQuotationRequest2')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }

    client.query(`SELECT DISTINCT ON (nano_leads.id) nano_leads.*, nano_sales.*, u1.user_name AS sales_coord
    FROM nano_leads LEFT JOIN nano_sales ON nano_sales.lead_id = nano_leads.id
    LEFT JOIN nano_user u1 ON nano_leads.sales_coordinator = u1.uid
    WHERE nano_sales.quotation_request = true
    ORDER BY nano_leads.id, nano_sales.quotation_request_date DESC`).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    })

  })

})

//Lead/Sales that have SOF generated, with similar data of getLeadList3
app.post('/getLeadList3SOFversion', async (req, res) => {
  console.log('getLeadList3SOFversion')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }

    client.query(`WITH selected AS (
            SELECT nl.id AS lead_id, 
            CASE
               WHEN EXISTS (SELECT * FROM nano_sales_order nso WHERE nso.lead_id = nl.id)
               THEN true
              ELSE false
            END AS sof, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
              (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
              (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
              ELSE nl.created_date::bigint end) AS created_date,
              CASE 
              WHEN nl.customer_phone IS NULL THEN 0
              ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
              END as phone_row_number,
              CASE 
              WHEN nl.address IS NULL THEN 0
              ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
              END as address_row_number,
              nls.status AS whole_status, nls.final_approval,
              nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
                nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
                nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to, nat.checkin,
                (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid,
                (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ( ac_approval IS NULL OR sc_approval IS NULL ) ) AS pending_approve, 
                (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
                (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
                nls.subcon_state, nls.finance_check, nls.finance_remark, 
                (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
                nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
                FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
                LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
                nano_sales nls ON nat.id = nls.appointment_id
              ),
              sof_latest AS (
                SELECT DISTINCT ON (s.lead_id) 
                    s.lead_id,
                    (SELECT created_date::BIGINT AS sof_latest_created_date FROM nano_sales_order nso WHERE nso.lead_id = s.lead_id ORDER BY nso.created_date LIMIT 1) AS sof_latest_created_date,
                    (SELECT JSON_AGG(user_name) FROM nano_user WHERE uid IN (SELECT value::text FROM JSONB_ARRAY_ELEMENTS_TEXT(s.assigned_to4::JSONB))) AS user_name
                FROM selected s
                ORDER BY s.lead_id
            )
            SELECT s.*, sl.sof_latest_created_date, sl.user_name
            FROM selected s
            LEFT JOIN sof_latest sl ON s.lead_id = sl.lead_id
            WHERE s.sof = true AND ((s.created_date::bigint) > $1 AND (s.created_date::bigint) < $2)`, [req.body.startDate, req.body.endDate]
    ).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })
    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    })

  })

})

app.post('/getLeadList3SOFversion2', async (req, res) => {
  console.log('getLeadList3SOFversion2')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }
    // AND ((sof.sof_latest_created_date::BIGINT) > $1 AND (sof.sof_latest_created_date::BIGINT) < $2);

    client.query(`SELECT DISTINCT ON (nl.id)  nl.*, ns.*, sof.sof_latest_created_date, sof.isvoid, u1.user_name AS sales_coord,
      ( SELECT JSON_AGG(user_name) FROM nano_user WHERE uid IN ( SELECT value::text FROM JSONB_ARRAY_ELEMENTS_TEXT(nat.assigned_to4::JSONB))) AS user_name,
      ( SELECT SUM(total) FROM nano_payment_log WHERE sales_id = ns.id AND (ac_approval IS NULL OR sc_approval IS NULL)) AS pending_approve
      FROM nano_leads nl
      LEFT JOIN nano_sales ns ON ns.lead_id = nl.id
      LEFT JOIN (SELECT lead_id, MAX(created_date::BIGINT) AS sof_latest_created_date, isvoid FROM nano_sales_order GROUP BY lead_id, isvoid) AS sof ON sof.lead_id = ns.lead_id
      LEFT JOIN nano_user u1 ON nl.sales_coordinator = u1.uid
      LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id
      WHERE (EXISTS (SELECT 1 FROM nano_sales_order nso WHERE nso.lead_id = nl.id))
      AND ((sof.sof_latest_created_date::BIGINT) > $1 AND (sof.sof_latest_created_date::BIGINT) < $2);
    `, [req.body.startDate, req.body.endDate]
    ).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })
    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    })

  })

})

app.post('/getLeadList3SOFversion2a', async (req, res) => {
  console.log('getLeadList3SOFversion2a')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }
    // AND ((sof.sof_latest_created_date::BIGINT) > $1 AND (sof.sof_latest_created_date::BIGINT) < $2);

    client.query(`SELECT DISTINCT ON (nl.id)  nl.*, ns.*, sof.sof_latest_created_date, sof.isvoid, u1.user_name AS sales_coord,
      ( SELECT JSON_AGG(user_name) FROM nano_user WHERE uid IN ( SELECT value::text FROM JSONB_ARRAY_ELEMENTS_TEXT(nat.assigned_to4::JSONB))) AS user_name,
      ( SELECT SUM(total) FROM nano_payment_log WHERE sales_id = ns.id AND (ac_approval IS NULL OR sc_approval IS NULL)) AS pending_approve
      FROM nano_leads nl
      LEFT JOIN nano_sales ns ON ns.lead_id = nl.id
      LEFT JOIN (SELECT lead_id, MAX(created_date::BIGINT) AS sof_latest_created_date, isvoid FROM nano_sales_order GROUP BY lead_id, isvoid) AS sof ON sof.lead_id = ns.lead_id
      LEFT JOIN nano_user u1 ON nl.sales_coordinator = u1.uid
      LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id
      WHERE (EXISTS (SELECT 1 FROM nano_sales_order nso WHERE nso.lead_id = nl.id))
    `, []
    ).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })
    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    })

  })

})

app.post('/getLeadListAttended', async (req, res) => {
  console.log('getLeadListAttended')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }

    client.query(`SELECT nl.*, ns.*, sof.sof_latest_created_date, u1.user_name AS sales_coord, nc.check_time as checkin_time, nla.id AS label_m_id,
    nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour,
      ( SELECT JSON_AGG(user_name) FROM nano_user WHERE uid IN ( SELECT value::text FROM JSONB_ARRAY_ELEMENTS_TEXT(nat.assigned_to4::JSONB))) AS user_name,
      ( SELECT SUM(total) FROM nano_payment_log WHERE sales_id = ns.id AND (ac_approval IS NULL OR sc_approval IS NULL)) AS pending_approve
      FROM nano_leads nl
      LEFT JOIN nano_sales ns ON ns.lead_id = nl.id
      LEFT JOIN (SELECT lead_id, MAX(created_date::BIGINT) AS sof_latest_created_date FROM nano_sales_order GROUP BY lead_id) AS sof ON sof.lead_id = ns.lead_id
      LEFT JOIN nano_user u1 ON nl.sales_coordinator = u1.uid
      LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id
      LEFT JOIN (SELECT DISTINCT ON (appointment_id) appointment_id, check_time FROM nano_check ORDER BY appointment_id, check_time DESC) nc ON nat.id = nc.appointment_id
      LEFT JOIN nano_label nla ON nl.label_m = nla.id
      LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id
      WHERE nc.check_time IS NOT NULL AND ((ns.created_date::BIGINT) > $1 AND (ns.created_date::BIGINT) < $2) ORDER BY nc.check_time::BIGINT DESC 
    `, [req.body.startDate, req.body.endDate]
    ).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })
    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    })

  })

})


app.post('/getLeadList3paymentversion', async (req, res) => {
  console.log('getLeadList3paymentversion')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }

    client.query(`WITH selected AS (
            SELECT nl.id AS lead_id, 
            CASE
               WHEN EXISTS(SELECT * FROM nano_payment_log npl2 WHERE npl2.sales_id = nls.id)
               THEN true
              ELSE false
            END AS payment, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
              (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
              (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
              ELSE nl.created_date::bigint end) AS created_date,
              CASE 
              WHEN nl.customer_phone IS NULL THEN 0
              ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
              END as phone_row_number,
              CASE 
              WHEN nl.address IS NULL THEN 0
              ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
              END as address_row_number,
              nls.status AS whole_status,
              nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
                nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
                nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to, nat.checkin,
                (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
                (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ( ac_approval IS NULL OR sc_approval IS NULL ) ) AS pending_approve, 
                (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
                (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
                nls.subcon_state, nls.finance_check, nls.finance_remark, 
                (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
                nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
                FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
                LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
                nano_sales nls ON nat.id = nls.appointment_id
              ) SELECT *, assigned_to4, (SELECT JSON_AGG(user_name) from nano_user 
              WHERE uid IN (
        SELECT value::text
        FROM JSONB_ARRAY_ELEMENTS_TEXT(assigned_to4::JSONB)
        )) as user_name FROM selected WHERE payment = true AND ((created_date::bigint) > $1 AND (created_date::bigint) < $2)`, [req.body.startDate, req.body.endDate]
    ).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    })

  })

})

app.post('/getLeadList3scheduleversion', async (req, res) => {
  console.log('getLeadList3scheduleversion')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }


    client.query(`WITH filtered_leads AS (
      SELECT 
        nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,nl.created_date::bigint AS created_date,
        nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, 
        nl.issues, nl.status AS lead_status, nl.ads_id, nl.channel_id, nl.lattitude, nl.longtitude,nl.label_m,nl.label_s,nat.kiv, nat.appointment_status, nat.assigned_to4, nat.assigned_to, 
        nat.checkin,nls.id AS sales_id, nls.status AS whole_status,nls.payment_status, nls.total AS payment_total, nls.sales_status, nls.subcon_state, nls.finance_check, 
        nls.finance_remark,u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
      FROM nano_leads nl
      LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id
      LEFT JOIN nano_user u1 ON nl.created_by = u1.uid
      LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
      LEFT JOIN nano_label nla ON nl.label_m = nla.id
      LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id
      LEFT JOIN nano_sales nls ON nat.id = nls.appointment_id
      WHERE nl.created_date::bigint > $1 AND nl.created_date::bigint < $2),
    schedule_counts AS (SELECT sales_id, COUNT(*) AS schedule_count, JSON_AGG(JSON_BUILD_OBJECT('schedule_date', schedule_date::bigint)) AS schedule_list
      FROM nano_schedule GROUP BY sales_id),
    total_paid_sums AS (SELECT sales_id, SUM(total) AS total_paid
      FROM nano_payment_log WHERE ac_approval = 'Approved' AND sc_approval = 'Approved' GROUP BY sales_id),
    result AS (SELECT fl.*, sc.schedule_count, sc.schedule_list, COALESCE(tp.total_paid, 0) AS total_paid,
        CASE 
          WHEN tp.total_paid IS NOT NULL AND fl.payment_total = tp.total_paid THEN fl.sales_id ELSE NULL 
        END AS approved_paid,
        (SELECT JSON_AGG(user_name) FROM nano_user WHERE uid IN (
          SELECT value::text FROM JSONB_ARRAY_ELEMENTS_TEXT(fl.assigned_to4::JSONB)
        )) AS user_name,
        (SELECT category FROM nano_channel WHERE name = fl.channel_id) AS category
      FROM filtered_leads fl
      LEFT JOIN schedule_counts sc ON fl.sales_id = sc.sales_id
      LEFT JOIN total_paid_sums tp ON fl.sales_id = tp.sales_id
      WHERE sc.schedule_count > 0)
    SELECT * FROM result;
    `, [req.body.startDate, req.body.endDate]
    ).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      release()
      console.log(error)
      return res.status(800).send({ success: false })
    })

  })

})




app.post('/getLeadList2', async (req, res) => {
  console.log('getLeadList2')
  pool.query(`WITH selected AS (
      SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
        (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
        (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
        ELSE nl.created_date::bigint end) AS created_date,
        CASE 
        WHEN nl.customer_phone IS NULL THEN 0
        ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
        END as phone_row_number,
        CASE 
        WHEN nl.address IS NULL THEN 0
        ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
        END as address_row_number,
        nls.status AS whole_status,
        nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
          nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
          nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to as sales_exec,  nat.checkin,
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
          (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
          nls.subcon_state, nls.finance_check, nls.finance_remark, 
          (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
          nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
          FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
          LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
          nano_sales nls ON nat.id = nls.appointment_id WHERE exists (select * from json_array_elements_text(nat.assigned_to4) as ppl where ppl = $1 )
        ) SELECT * FROM selected WHERE (phone_row_number = 1 OR phone_row_number = 0) OR warranty_id IS NOT NULL OR verified = true ORDER BY created_date DESC`, [req.body.uid]
  ).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})


app.post('/getLeadListForApp', async (req, res) => {
  console.log('getLeadListForApp')
  pool.query(`WITH selected AS (
      SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
        (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
        (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
        ELSE nl.created_date::bigint end) AS created_date,
        CASE 
        WHEN nl.customer_phone IS NULL THEN 0
        ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
        END as phone_row_number,
        CASE 
        WHEN nl.address IS NULL THEN 0
        ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
        END as address_row_number,
        nls.status AS whole_status,
        nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
          nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
          nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to as sales_exec,  nat.checkin,
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
          (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
          nls.subcon_state, nls.finance_check, nls.finance_remark, 
          (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
          nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
          FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
          LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
          nano_sales nls ON nat.id = nls.appointment_id WHERE exists (select * from json_array_elements_text(nat.assigned_to4) as ppl where ppl = $1 )
        ) SELECT * FROM selected WHERE ((phone_row_number = 1 OR phone_row_number = 0) OR warranty_id IS NOT NULL OR verified = true) AND (created_date >= $2 AND created_date <= $3) ORDER BY created_date DESC`, [req.body.uid, req.body.fromdate, req.body.todate]
  ).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})


app.post('/getLeadListForAppByname', async (req, res) => {
  console.log('getLeadListForAppByname')
  pool.query(`WITH selected AS (
      SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
        (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
        (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
        ELSE nl.created_date::bigint end) AS created_date,
        CASE 
        WHEN nl.customer_phone IS NULL THEN 0
        ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
        END as phone_row_number,
        CASE 
        WHEN nl.address IS NULL THEN 0
        ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
        END as address_row_number,
        nls.status AS whole_status,
        nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
          nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
          nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to as sales_exec,  nat.checkin,
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
          (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
          nls.subcon_state, nls.finance_check, nls.finance_remark, 
          (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
          nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
          FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
          LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
          nano_sales nls ON nat.id = nls.appointment_id WHERE exists (select * from json_array_elements_text(nat.assigned_to4) as ppl where ppl = $1 )
        ) SELECT * FROM selected WHERE (LOWER(customer_name) LIKE ($2) OR customer_phone LIKE ($2)) ORDER BY created_date DESC`, [req.body.uid, '%' + req.body.keyword + '%']
  ).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})



app.post('/getPendingAppointment', async (req, res) => {
  console.log('getPendingAppointment')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }

    let role = req.body.user_role
    if (role == 'Super Admin' || role == 'System Admin') {
      client.query(`WITH selected AS (
          SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, 
        nla2.colour AS label_s_colour, nl.warranty_id,
            (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
            (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
            ELSE nl.created_date::bigint end) AS created_date,
            CASE 
            WHEN nl.customer_phone IS NULL THEN 0
            ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
            END as phone_row_number,
            CASE 
            WHEN nl.address IS NULL THEN 0
            ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
            END as address_row_number,
            nls.status AS whole_status,
            nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
              nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
              nls.total AS payment_total, nls.sales_status, nat.assigned_to4,  nat.assigned_to, nat.checkin,
              (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
              (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
              (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
              nls.subcon_state, nls.finance_check, nls.finance_remark, 
              (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
              nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
              FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
              LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN
              nano_sales nls ON nat.id = nls.appointment_id
            ) SELECT * FROM selected WHERE ( label_s = 'Pending Appointment Date' OR  label_s = 'Appointment Cancelled' OR label_s = 'Appointment Reschedule') OR ( verified = true AND warranty_id IS NULL)
            ORDER BY created_date desc`
      ).then((result) => {
        release()
        return res.status(200).send({ data: result.rows, success: true })
      }).catch((error) => {
        release()
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }
    else if (role == 'Sales Coordinator') {
      // ( label_s = 'Pending Appointment Date' OR  label_s = 'Appointment Cancelled' OR label_s = 'Appointment Reschedule') AND (((phone_row_number = 1 OR phone_row_number = 0) OR verified = true) AND warranty_id IS NULL)
      client.query(`WITH selected AS (
          SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, 
        nla2.colour AS label_s_colour, nl.warranty_id,
            (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
            (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
            ELSE nl.created_date::bigint end) AS created_date,
            CASE 
            WHEN nl.customer_phone IS NULL THEN 0
            ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
            END as phone_row_number,
            CASE 
            WHEN nl.address IS NULL THEN 0
            ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
            END as address_row_number,
            nls.status AS whole_status,
            nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
              nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
              nls.total AS payment_total, nls.sales_status, nat.assigned_to4,  nat.assigned_to, nat.checkin,
              (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
              (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
              (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
              nls.subcon_state, nls.finance_check, nls.finance_remark, 
              (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
              nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
              FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
              LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN
              nano_sales nls ON nat.id = nls.appointment_id
            ) SELECT * FROM selected WHERE  ( label_s = 'Pending Appointment Date' OR  label_s = 'Appointment Cancelled' OR label_s = 'Appointment Reschedule') OR ( verified = true AND warranty_id IS NULL)
            ORDER BY created_date desc`
      ).then((result) => {
        release()
        return res.status(200).send({ data: result.rows, success: true })

      }).catch((error) => {
        release()
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }
    else if (role == 'Sales Executive') {
      client.query(`WITH selected AS (
          SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, 
        nla2.colour AS label_s_colour, nl.warranty_id,
            (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
            (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
            ELSE nl.created_date::bigint end) AS created_date,
            CASE 
            WHEN nl.customer_phone IS NULL THEN 0
            ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
            END as phone_row_number,
            CASE 
            WHEN nl.address IS NULL THEN 0
            ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
            END as address_row_number,
            nls.status AS whole_status,
            nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
              nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
              nls.total AS payment_total, nls.sales_status, nat.assigned_to4,  nat.assigned_to, nat.checkin,
              (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
              (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
              (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
              nls.subcon_state, nls.finance_check, nls.finance_remark, 
              (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
              nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
              FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
              LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN
              nano_sales nls ON nat.id = nls.appointment_id WHERE exists(select * from json_array_elements_text(nat.assigned_to4) as ppl where ppl = $1 )
            ) SELECT * FROM selected WHERE ( label_s = 'Pending Appointment Date' OR  label_s = 'Appointment Cancelled' OR label_s = 'Appointment Reschedule') OR ( verified = true AND warranty_id IS NULL)
            ORDER BY created_date desc`, [req.body.user_uid]
      ).then((result) => {
        release()
        return res.status(200).send({ data: result.rows, success: true })

      }).catch((error) => {
        release()
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }
    else {
      client.query(`WITH selected AS (
          SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, 
        nla2.colour AS label_s_colour, nl.warranty_id,
            (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
            (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
            ELSE nl.created_date::bigint end) AS created_date,
            CASE 
            WHEN nl.customer_phone IS NULL THEN 0
            ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
            END as phone_row_number,
            CASE 
            WHEN nl.address IS NULL THEN 0
            ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
            END as address_row_number,
            nls.status AS whole_status,
            nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
              nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
              nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to, nat.checkin,
              (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
              (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
              (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
              nls.subcon_state, nls.finance_check, nls.finance_remark, 
              (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
              nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
              FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
              LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN
              nano_sales nls ON nat.id = nls.appointment_id
            ) SELECT * FROM selected WHERE  ( label_s = 'Pending Appointment Date' OR  label_s = 'Appointment Cancelled' OR label_s = 'Appointment Reschedule') OR ( verified = true AND warranty_id IS NULL)
            ORDER BY created_date desc`
      ).then((result) => {
        release()
        return res.status(200).send({ data: result.rows, success: true })

      }).catch((error) => {
        release()
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }


  })

})

// app.post('/getPendingAppointmenttest', async (req, res) => {
//   try {
//     console.log('getPendingAppointmenttest');
//     const role = req.body.user_role;
//     const query = `
//   SELECT
//     nl.id AS lead_id,
//     nl.customer_title,
//     nla.name AS label_m,
//     nla.colour AS label_m_colour,
//     nla2.name AS label_s,
//     nla2.colour AS label_s_colour,
//     nl.warranty_id,
//     CASE
//       WHEN nl.customer_phone IS NULL THEN 0
//       ELSE ROW_NUMBER() OVER (PARTITION BY nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
//     END AS phone_row_number,
//     CASE
//       WHEN nl.address IS NULL THEN 0
//       ELSE ROW_NUMBER() OVER (PARTITION BY nl.address ORDER BY nl.created_date ASC NULLS LAST)
//     END AS address_row_number,
//     nls.status AS whole_status,
//     nl.customer_name,
//     nl.customer_email,
//     nl.customer_phone,
//     nl.customer_city,
//     nl.customer_state,
//     nl.verified,
//     nl.address,
//     nl.company_address,
//     nl.saleexec_note,
//     nl.remark,
//     nl.services,
//     nl.issues,
//     nl.status AS lead_status,
//     nl.ads_id,
//     nl.channel_id,
//     nat.kiv,
//     nat.appointment_status,
//     nls.payment_status,
//     nls.total AS payment_total,
//     nls.sales_status,
//     nat.assigned_to4,
//     nat.assigned_to,
//     nat.checkin,
//     (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid,
//     (SELECT id FROM nano_sales WHERE id = nls.id AND total = (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid,
//     nls.subcon_state,
//     nls.finance_check,
//     nls.finance_remark,
//     (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
//     nl.lattitude,
//     nl.longtitude,
//     u1.user_name AS created_by,
//     u3.user_name AS sales_coord,
//     u3.uid AS sales_coord_uid,
//     CASE
//       WHEN nl.created_date ~ '^[0-9\.]+$'
//       THEN EXTRACT(EPOCH FROM nl.created_date::date) * 1000
//       ELSE EXTRACT(EPOCH FROM NOW()) * 1000
//     END AS created_date
//   FROM
//     nano_leads nl
//   LEFT JOIN
//     nano_appointment nat ON nl.id = nat.lead_id
//   LEFT JOIN
//     nano_user u1 ON nl.created_by = u1.uid
//   LEFT JOIN
//     nano_user u3 ON nl.sales_coordinator = u3.uid
//   LEFT JOIN
//     nano_label nla ON nl.label_m = nla.id
//   LEFT JOIN
//     nano_label nla2 ON nl.label_s = nla2.id
//   LEFT JOIN
//     nano_sales nls ON nat.id = nls.appointment_id
//   WHERE
//     (($1 = 'Super Admin' OR $1 = 'System Admin')
//       OR ($1 = 'Sales Coordinator' AND nat.assigned_to4::text LIKE '%' || $2 || '%')
//       OR ($1 = 'Sales Executive' AND nat.assigned_to4::text LIKE '%' || $2 || '%'))
//     AND (nl.created_date ~ '^[0-9\.]+$' AND nl.created_date::bigint IS NOT NULL)  -- Filter out non-numeric created_date values
//     AND ((label_s IN ('Pending Appointment Date', 'Appointment Cancelled', 'Appointment Reschedule'))
//       OR (nl.verified = TRUE AND nl.warranty_id IS NULL))
//   ORDER BY
//     created_date DESC`;

//     const result = await pool.query(query, [role, req.body.user_uid]);

//     return res.status(200).send({ data: result.rows, success: true });
//   } catch (error) {
//     console.log(error);
//     return res.status(800).send({ success: false });
//   }
// });

app.post('/getWarrantyList', async (req, res) => {
  console.log('getWarrantyList')
  let role = req.body.user_role
  if (role == 'Super Admin' || role == 'System Admin') {
    pool.query(`WITH selected AS (
      SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
        (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
        (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
        ELSE nl.created_date::bigint end) AS created_date,
        CASE 
        WHEN nl.customer_phone IS NULL THEN 0
        ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
        END as phone_row_number,
        CASE 
        WHEN nl.address IS NULL THEN 0
        ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
        END as address_row_number,
        nls.status AS whole_status,
        nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
          nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
          nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to, nat.checkin,
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
          (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
          nls.subcon_state, nls.finance_check, nls.finance_remark, 
          (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
          nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
          FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
          LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN
          nano_sales nls ON nat.id = nls.appointment_id WHERE nla2.name = 'Pending Appointment Date' 
        ) SELECT * FROM selected WHERE ((phone_row_number = 1 OR phone_row_number = 0) OR verified = true) AND warranty_id IS NOT NULL `
    ).then((result) => {
      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  }
  else if (role == 'Sales Coordinator') {
    pool.query(`WITH selected AS (
      SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, 
    nla2.colour AS label_s_colour, nl.warranty_id,
        (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
        (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
        ELSE nl.created_date::bigint end) AS created_date,
        CASE 
        WHEN nl.customer_phone IS NULL THEN 0
        ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
        END as phone_row_number,
        CASE 
        WHEN nl.address IS NULL THEN 0
        ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
        END as address_row_number,
        nls.status AS whole_status,
        nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
          nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
          nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to, nat.checkin,
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
          (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
          nls.subcon_state, nls.finance_check, nls.finance_remark, 
          (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
          nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
          FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
          LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN
          nano_sales nls ON nat.id = nls.appointment_id WHERE nla2.name = 'Pending Appointment Date' AND u3.uid = $1
        ) SELECT * FROM selected WHERE ((phone_row_number = 1 OR phone_row_number = 0) OR verified = true) AND warranty_id IS NOT NULL`, [req.body.user_uid]
    ).then((result) => {
      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  }
  else if (role == 'Sales Executive') {
    pool.query(`WITH selected AS (
      SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, 
    nla2.colour AS label_s_colour, nl.warranty_id,
        (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
        (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
        ELSE nl.created_date::bigint end) AS created_date,
        CASE 
        WHEN nl.customer_phone IS NULL THEN 0
        ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
        END as phone_row_number,
        CASE 
        WHEN nl.address IS NULL THEN 0
        ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
        END as address_row_number,
        nls.status AS whole_status,
        nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
          nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
          nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to, nat.checkin,
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
          (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
          nls.subcon_state, nls.finance_check, nls.finance_remark, 
          (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
          nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
          FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
          LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN
          nano_sales nls ON nat.id = nls.appointment_id WHERE nla2.name = 'Pending Appointment Date' AND exists(select * from json_array_elements_text(nat.assigned_to4) as ppl where ppl = $1 )
        ) SELECT * FROM selected WHERE ((phone_row_number = 1 OR phone_row_number = 0) OR verified = true) AND warranty_id IS NOT NULL`, [req.body.user_uid]
    ).then((result) => {
      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  }
})


app.post('/getMyLead', async (req, res) => {
  console.log('getMyLead')
  let role = req.body.user_role
  if (role == 'Sales Coordinator') {
    pool.query(`WITH selected AS (
      SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, 
    nla2.colour AS label_s_colour, nl.warranty_id,
        (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
        (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
        ELSE nl.created_date::bigint end) AS created_date,
        CASE 
        WHEN nl.customer_phone IS NULL THEN 0
        ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
        END as phone_row_number,
        CASE 
        WHEN nl.address IS NULL THEN 0
        ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
        END as address_row_number,
        nls.status AS whole_status,
        nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
          nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
          nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to, nat.checkin,
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
          (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
          nls.subcon_state, nls.finance_check, nls.finance_remark, 
          (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
          nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
          FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
          LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
          nano_sales nls ON nat.id = nls.appointment_id WHERE u3.uid = $1 
        ) SELECT * FROM selected WHERE  ((created_date::bigint) > $2 AND (created_date::bigint) < $3) `, [req.body.user_uid, req.body.startDate, req.body.endDate]
    ).then((result) => {
      return res.status(200).send({ data: result.rows, success: true })
      // ((phone_row_number = 1 OR phone_row_number = 0) OR warranty_id IS NOT NULL OR verified = true) AND
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  }
  else if (role == 'Sales Executive') {
    pool.query(`WITH selected AS (
      SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, 
    nla2.colour AS label_s_colour, nl.warranty_id,
        (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
        (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
        ELSE nl.created_date::bigint end) AS created_date,
        CASE 
        WHEN nl.customer_phone IS NULL THEN 0
        ELSE  row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC NULLS LAST)
        END as phone_row_number,
        CASE 
        WHEN nl.address IS NULL THEN 0
        ELSE row_number() over (partition by nl.address ORDER BY nl.created_date ASC NULLS LAST)
        END as address_row_number,
        nls.status AS whole_status,
        nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
          nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status, 
          nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.assigned_to, nat.checkin,
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
          (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
          (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
          nls.subcon_state, nls.finance_check, nls.finance_remark, 
          (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
          nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
          FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
          LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
          nano_sales nls ON nat.id = nls.appointment_id WHERE exists(select * from json_array_elements_text(nat.assigned_to4) as ppl where ppl = $1 )
        ) SELECT * FROM selected WHERE ((created_date::bigint) > $2 AND (created_date::bigint) < $3)`, [req.body.user_uid, req.body.startDate, req.body.endDate]
    ).then((result) => {
      return res.status(200).send({ data: result.rows, success: true })
      // ( (phone_row_number = 1 OR phone_row_number = 0) OR warranty_id IS NOT NULL OR verified = true)  AND
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  }
  else {
    return res.status(200).send({ data: 'no this role', success: false })
  }
})
// app.post('/getDuplicateList', async (req, res) => {
//   console.log('getDuplicateList')
//   pool.query(`	  WITH selected AS (
//     SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
//       (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
//       (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
//       ELSE nl.created_date::bigint end) AS created_date,
//       row_number() over (partition by nl.customer_phone ORDER BY nl.created_date DESC) as phone_row_number,
//       row_number() over (partition by nl.address ORDER BY nl.created_date DESC) as address_row_number,
//       nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
//         nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,nl.status AS lead_status,nl.ads_id, nl.channel_id, nls.payment_status, nls.total AS payment_total, nls.sales_status, nat.assigned_to4, nat.checkin,
//         (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
//         (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, nls.subcon_state, nls.finance_check, nls.finance_remark, 
//         (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
//         nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
//         FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
//         LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN
//         nano_sales nls ON nat.id = nls.appointment_id WHERE  verified IS NULL AND nl.warranty_id IS NULL AND nl.address IS NOT NULL
//       ) SELECT * FROM selected where (phone_row_number > 1 OR address_row_number > 1) AND created_date > $1 AND created_date < $2 `, [req.body.startDate, req.body.endDate]
//   ).then((result) => {
//     return res.status(200).send({ data: result.rows, success: true })

//   }).catch((error) => {
//     console.log(error)
//     return res.status(800).send({ success: false })
//   })

// })

app.post('/getDuplicateList', async (req, res) => {
  console.log('getDuplicateList')
  pool.query(`SELECT lead_id, customer_title, label_m, label_m_colour, label_s, label_s_colour, warranty_id, created_date, customer_name, customer_email, customer_phone, customer_city, customer_state, verified,
  address, company_address, saleexec_note, remark, services, issues::JSONB, lead_status, ads_id, channel_id, payment_status, payment_total, sales_status, assigned_to4, checkin, total_paid,
   approved_paid, subcon_state, finance_check, finance_remark, category, lattitude, longtitude, created_by, sales_coord, sales_coord_uid
  FROM (
    SELECT nl.id AS lead_id, nl.customer_title, nla.id AS label_m_id, nla.name AS label_m, nla.colour AS label_m_colour, nla2.id AS label_s_id, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
    (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
    (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
    ELSE nl.created_date::bigint end) AS created_date,
    row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC) as phone_row_number,
    row_number() over (partition by nl.address ORDER BY nl.created_date ASC) as address_row_number,
    nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
    nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues, nl.status AS lead_status, nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status,
     nls.total AS payment_total, nls.sales_status, nat.assigned_to4::TEXT, nat.assigned_to,  nat.checkin,
    (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
    (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, nls.subcon_state, nls.finance_check, nls.finance_remark, 
    (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
    nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
    FROM nano_leads nl 
    LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id 
    LEFT JOIN nano_user u1 ON nl.created_by = u1.uid 
    LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
    LEFT JOIN nano_label nla ON nl.label_m = nla.id 
    LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id 
    LEFT JOIN nano_sales nls ON nat.id = nls.appointment_id 
  ) AS subq
  WHERE phone_row_number > 1 AND verified IS NULL AND warranty_id IS NULL AND (created_date > $1 AND created_date < $2)
  GROUP BY lead_id, customer_title, label_m, label_m_colour, label_s, label_s_colour, warranty_id, created_date, customer_name, customer_email, customer_phone, customer_city, customer_state, verified,
  address, company_address, saleexec_note, remark, services, issues::JSONB, lead_status, ads_id, channel_id, payment_status, payment_total, sales_status, assigned_to4::TEXT, checkin, total_paid, approved_paid,
   subcon_state, finance_check, finance_remark, category, lattitude, longtitude, created_by, sales_coord, sales_coord_uid`, [req.body.startDate, req.body.endDate]
  ).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})


app.post('/verifyDuplicate', async (req, res) => {
  console.log('verifyDuplicate')
  pool.query(`UPDATE nano_leads SET verified = $1 WHERE id = $2`, [req.body.verified, req.body.lead_id]
  ).then((result) => {
    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false, err: error.message })
  })
})

app.post('/getNanoActivityLog', async (req, res) => {
  console.log('getNanoActivityLog')
  pool.query(`SELECT * FROM nano_activity_log WHERE lead_id = $1`, [req.body.lead_id]
  ).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/getSubActivityLog', async (req, res) => {
  console.log('getSubActivityLog')
  pool.query(`SELECT * FROM nano_activity_log WHERE sales_id = $1`, [req.body.sales_id]
  ).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

//Manage finance
app.post('/updateFinanceCheck', async (req, res) => {
  console.log('updateFinanceCheck')

  pool.query(`UPDATE nano_sales SET finance_check = $1, finance_remark = $2
   WHERE id = $3`,
    [req.body.finance_check, req.body.finance_remark, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})


// update subcon in sales
app.post('/updateSalesMaintain', async (req, res) => {
  console.log('updateSalesMaintain')

  pool.query(`UPDATE nano_sales SET (m_choice, m_state, m_pending_subcon, selected_photo) = ($1, $2, $3, $5)
   WHERE id = (SELECT id FROM nano_sales WHERE appointment_id = $4)`,
    [req.body.m_choice, req.body.m_state, req.body.m_pending_subcon, req.body.id, req.body.selected_photo]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})

// update subcon in sales
app.post('/updateSalesSub', async (req, res) => {
  console.log('updateSalesSub')

  pool.query(`UPDATE nano_sales SET (subcon_choice, subcon_state, pending_subcon) = ($1, $2, $3)
   WHERE id = (SELECT id FROM nano_sales WHERE appointment_id = $4)`,
    [req.body.choice, req.body.state, req.body.pending_subcon, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})

// update subcon in sales
app.post('/updateSalesSub3', async (req, res) => {
  console.log('updateSalesSub3')

  pool.query(`UPDATE nano_sales SET (subcon_choice, subcon_state, pending_subcon, selected_photo) = ($1, $2, $3, $5)
   WHERE id = (SELECT id FROM nano_sales WHERE appointment_id = $4)`,
    [req.body.choice, req.body.state, req.body.pending_subcon, req.body.id, req.body.selected_photo]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})


app.post('/updateSalesSub2', async (req, res) => {
  console.log('updateSalesSub2')

  let now = new Date().getTime()
  pool.query(`
  SELECT user_name FROM sub_user WHERE uid = $1
`, [req.body.uid]).then((result) => {
    let by = result.rows[0]['user_name']

    pool.query(`WITH updatesales as (UPDATE nano_sales SET (subcon_choice, subcon_state, pending_subcon) = ($1, $2, $3)
   WHERE id = (SELECT id FROM nano_sales WHERE appointment_id = $4) RETURNING *),
   insertactivitylog as (INSERT INTO nano_activity_log (lead_id, sales_id, activity_time, activity_by, remark, activity_type) 
  VALUES ($5, (SELECT id FROM updatesales) ,$6, $7, $8, $9)),
  insertscnotification as (INSERT INTO nano_sc_notification (sn_created_date, lead_id, sn_remark, uid, to_id) 
  VALUES ($6, $5, $8, $7, (SELECT sales_coordinator FROM nano_leads WHERE id = $5)))
  SELECT * FROM updatesales`,
      [req.body.choice, req.body.state, req.body.pending_subcon, req.body.id, req.body.lead_id, now, req.body.uid,
      req.body.log + 'by ' + by, req.body.activity_type]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/updateSalesSubTeam', async (req, res) => {
  console.log('updateSalesSubTeam')

  pool.query(`UPDATE nano_sales SET sub_team = $1, is_postpone = $3
   WHERE id = $2`,
    [req.body.sub_team, req.body.sales_id, false]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})

app.get('/getdata', async (req, res) => {
  console.log('getdata')

  pool.query(`SELECT * FROM nano_user`).then((result) => {

    return res.status(200).send({ success: true, data: result.rows })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/updatedata', async (req, res) => {
  console.log('updatedata')

  pool.query(`UPDATE nano_user SET oldid = $2 WHERE user_id = $1 `, [req.body.id, req.body.oldid]).then((result) => {

    return res.status(200).send({ success: true, data: result.rows })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

//ADS AND CHANNEL

app.get('/getAds', async (req, res) => {
  console.log('getAds')

  pool.query(`SELECT * FROM nano_ads ORDER BY created_date DESC`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/getSpecificAds', async (req, res) => {
  console.log('getSpecificAds')

  pool.query(`SELECT * FROM nano_ads WHERE id = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.get('/getChannel', async (req, res) => {
  console.log('getChannel')

  pool.query(`SELECT * FROM nano_channel WHERE status = true`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/getSpecificChannel', async (req, res) => {
  console.log('getSpecificChannel')

  pool.query(`SELECT * FROM nano_channel WHERE id = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/createAds', async (req, res) => {
  console.log('createAds')
  req.body.created = new Date().getTime()
  pool.query(`INSERT INTO nano_ads(name, status, created_date) 
   VALUES($1,true,$2)`, [req.body.name, req.body.created]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/createAds2', async (req, res) => {
  console.log('createAds')
  req.body.created = new Date().getTime()
  pool.query(`INSERT INTO nano_ads(name, status, created_date, ads_id, platform) 
   VALUES($1,true,$2,$3,$4)`, [req.body.name, req.body.created, req.body.ads_id, req.body.platform]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/createAds3', async (req, res) => {
  console.log('createAds')
  req.body.created = new Date().getTime()
  pool.query(`INSERT INTO nano_ads(name, status, created_date, ads_id, platform, price, image, video, activity, link) 
   VALUES($1,true,$2,$3,$4, $5, $6, $7, $8, $9)`, [req.body.name, req.body.created, req.body.ads_id, req.body.platform, req.body.price, req.body.image, req.body.video, req.body.activity, req.body.link]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/createAdsPlatform', async (req, res) => {
  console.log('createAdsPlatform')
  req.body.created = new Date().getTime()
  pool.query(`INSERT INTO ads_platform(name, date_created) 
   VALUES($1, $2)`, [req.body.name, req.body.created]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/updateAdsPlatform', async (req, res) => {
  console.log('updateAdsPlatform')
  req.body.update_date = new Date().getTime()
  pool.query(`UPDATE ads_platform SET (name, status, date_updated) = ($1,$2, $3) WHERE id = $4`, [req.body.name, req.body.status, req.body.update_date, req.body.id]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.get('/getAllAdsPlatform', async (req, res) => {
  console.log('getAllAdsPlatform')

  pool.query(`SELECT * FROM ads_platform ORDER by id DESC`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.get('/getActiveAdsPlatform', async (req, res) => {
  console.log('getActiveAdsPlatform')

  pool.query(`SELECT name FROM ads_platform WHERE status = true ORDER by id DESC`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/getOneAdsPlatform', async (req, res) => {
  console.log('getOneAdsPlatform')

  pool.query(`SELECT * FROM ads_platform WHERE id = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/createChannel', async (req, res) => {
  console.log('createChannel')
  req.body.created = new Date().getTime()
  pool.query(`INSERT INTO nano_channel(name, status, created_date, category) 
   VALUES($1,true,$2, $3)`, [req.body.name, req.body.created, req.body.category]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/updateAds', async (req, res) => {
  console.log('updateAds')
  req.body.update_date = new Date().getTime()
  pool.query(`UPDATE nano_ads SET (name, status, updated_date) = ($1,$2, $3) WHERE id = $4`, [req.body.name, req.body.status, req.body.update_date, req.body.id]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/updateAds2', async (req, res) => {
  console.log('updateAds2')
  req.body.update_date = new Date().getTime()
  pool.query(`UPDATE nano_ads SET (name, status, updated_date, platform, price, image, video, activity, link, ads_id) = ($1,$2, $3, $5, $6, $7, $8, $9, $10, $11) WHERE id = $4`,
    [req.body.name, req.body.status, req.body.update_date, req.body.id, req.body.platform, req.body.price, req.body.image, req.body.video, req.body.activity, req.body.link, req.body.ads_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updateChannel', async (req, res) => {
  console.log('updateChannel')
  req.body.update_date = new Date().getTime()
  pool.query(`UPDATE nano_channel SET (name, status, updated_date, category) = ($1,$2, $3, $5) WHERE id = $4`, [req.body.name, req.body.status, req.body.update_date, req.body.id, req.body.category]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


//Manage place
app.get('/getPlace', async (req, res) => {
  console.log('getPlace')

  pool.query(`SELECT * FROM nano_place`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/getSpecificPlace', async (req, res) => {
  console.log('getSpecificPlace')

  pool.query(`SELECT * FROM nano_place WHERE id = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})


app.post('/createPlace', async (req, res) => {
  console.log('createPlace')
  req.body.created = new Date().getTime()
  pool.query(`INSERT INTO nano_place(name, status, created_date) 
   VALUES($1,true,$2)`, [req.body.name, req.body.created]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})



app.post('/updatePlace', async (req, res) => {
  console.log('updatePlace')
  req.body.update_date = new Date().getTime()
  pool.query(`UPDATE nano_place SET (name, status, updated_date) = ($1,$2, $3) WHERE id = $4`, [req.body.name, req.body.status, req.body.update_date, req.body.id]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.post('/changepassword', (req, res) => {
  console.log('change');
  let uid = req.body.uid
  let password = req.body.password

  admin.auth().updateUser(uid, { password: password }).then(() => {


    pool.query("UPDATE nano_user SET password = $2 where uid = $1", [req.body.uid, password]).then((result) => {
      console.log('users');
      return res.status(200).send({ message: 'Change Successfully!' })
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: 'Not Ok' })
    })


  })

})

app.post('/subchangepassword', (req, res) => {
  console.log('change');
  let uid = req.body.uid
  let password = req.body.password

  admin.auth().updateUser(uid, { password: password }).then(() => {
    pool.query("UPDATE sub_company SET password = $2 where id = $1", [uid, password]).then((result) => {
      console.log('users');
      return res.status(200).send({ message: 'Change Successfully!' })
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: 'Not Ok' })
    })

  })

})

// Manage Equipment
app.get('/getEquipmentAll', async (req, res) => {
  console.log('getEquipmentAll')

  pool.query(`SELECT * FROM nano_equipment ORDER BY date_created DESC`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/getEquipmentOne', async (req, res) => {
  console.log('getSpegetEquipmentOnecificAds')

  pool.query(`SELECT * FROM nano_equipment WHERE id = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/createEquipment', async (req, res) => {
  console.log('createEquipment')
  req.body.created = new Date().getTime()
  pool.query(`INSERT INTO nano_equipment(name, price, type, date_created) 
   VALUES($1, $2, $3, $4)`, [req.body.name, req.body.price, req.body.type, req.body.created]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/updateEquipment', async (req, res) => {
  console.log('updateEquipment')
  req.body.update_date = new Date().getTime()
  pool.query(`UPDATE nano_equipment SET (name, price, type, status, date_updated) = ($1, $2, $3, $4, $5) WHERE id = $6`, [req.body.name, req.body.price, req.body.type, req.body.status, req.body.update_date, req.body.id]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


// (SELECT JSON_AGG(JSON_BUILD_OBJECT('se_name', name, 'se_phone', phone, 'se_email', email) FROM nano_user WHERE id IN na.assigned_to4::TEXT))
//Manage Sales
app.post('/getSales', (req, res) => {
  console.log('getSales');

  pool.query(`SELECT s.*, na.assigned_to4::JSONB,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('se_name', user_name, 'se_phone', user_phone_no, 'se_email', user_email)) 
  FROM nano_user WHERE uid IN (select jsonb_array_elements_text(assigned_to4::jsonb) FROM nano_appointment WHERE id = $1)) as se_data,
  CASE WHEN COUNT(nsd.id) > 0 THEN 
 (SELECT JSON_AGG(JSON_BUILD_OBJECT('photo',nsd.photo, 'sales_discount_id', nsd.id, 'name', nsd.name, 'percentage', nsd.percentage, 'type', nsd.type)) 
  FROM nano_sales ns2 LEFT JOIN nano_sales_discount nsd ON ns2.id = nsd.sales_id WHERE ns2.id = s.id)
  ELSE null END AS photo_from_discount_table, 
  b.id as promocode_id, b.name as promocode_name, b.percentage as promocode_percentage,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('sales_order_form', orderform, 'sof_breakdown', orderform_breakdown, 'created_date' , created_date, 'isvoid', isvoid) ORDER BY created_date DESC) FROM nano_sales_order WHERE appointment_id = $1) as salesorderform_list
  FROM nano_sales s LEFT JOIN nano_promo b ON s.promo_code = b.id LEFT JOIN nano_appointment na ON s.appointment_id = na.id
  LEFT JOIN nano_sales_discount nsd on nsd.sales_id = s.id WHERE appointment_id = $1 GROUP BY s.id, na.assigned_to4::JSONB, b.id`, [req.body.appointment_id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.get('/getEmptySubChoice', (req, res) => {
  console.log('getEmptySubChoice');

  pool.query(
    `SELECT nsl.*, nl.customer_name, nl.customer_phone,
    (SELECT COUNT(id) FROM nano_schedule WHERE sales_id = nsl.id) AS schedule_count,
    (SELECT * FROM
      (SELECT JSON_AGG(JSON_BUILD_OBJECT('schedule_date', schedule_date::bigint)) FROM
      (SELECT schedule_date FROM nano_schedule WHERE sales_id = nsl.id ORDER BY schedule_date ASC) p) agg) AS schedule
    FROM nano_sales nsl LEFT JOIN nano_leads nl ON nsl.lead_id = nl.id `
    //WHERE subcon_choice::text = '[]'
  ).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

// app.post('/getAllScheduleBySales', (req, res) => {
//   console.log('getAllScheduleBySales');

//   pool.query(`SELECT * FROM nano_schedule WHERE sales_id = $1 AND status = true`, [req.body.sales_id]).then((result) => {

//     return res.status(200).send({ data: result.rows, success: true })

//   }).catch((error) => {
//     console.log(error)
//     return res.status(800).send({ success: false })
//   })

// })

app.post('/getSalesPackageViaAppointment', (req, res) => {
  console.log('getSalesPackageViaAppointment')
  pool.query(`SELECT nsl.*, ns.name, ns.type,
  
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('dis_id', c.dis_id, 'dis_name' ,c.dis_name, 'dis_remark', c.dis_remark, 'dis_percentage', 
     c.dis_percentage, 'need_photo', c.need_photo, 'photo', c.photo, 'sales_package_id', 
     c.sales_package_id, 'dis_type', c.dis_type) ORDER BY c.dis_type DESC, c.dis_id) 
   FROM nano_sales_package_discount c WHERE c.sales_package_id = nsl.sap_id AND c.status) as dis_items,

   (SELECT JSON_AGG(JSON_BUILD_OBJECT('dis_id', nsd.id, 'dis_name' ,nsd.name, 'dis_remark', nsd.remark, 'dis_percentage', 
   nsd.percentage, 'need_photo', nsd.need_photo, 'photo', nsd.photo, 'sales_id', 
   nsd.sales_id, 'dis_type', nsd.type, 'discount_id', nsd.discount_id) ORDER BY nsd.type DESC, nsd.id) 
 FROM nano_sales_discount nsd WHERE nsd.sales_id = (SELECT id FROM nano_sales WHERE appointment_id = $1 )) as dis_items2

   FROM nano_sales_package nsl LEFT JOIN nano_packages ns ON nsl.package_id = ns.id
   WHERE sales_id = (SELECT id FROM nano_sales WHERE appointment_id = $1 )  `, [req.body.appointment_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getAllPackageDiscount', (req, res) => {
  console.log('getSalesPackageViaAppointment')
  pool.query(`SELECT d1.* FROM nano_sales_package nsp LEFT JOIN nano_sales_package_discount d1 ON d1.sales_package_id = nsp.sap_id AND d1.status = true
   WHERE sales_id = (SELECT id FROM nano_sales WHERE appointment_id = $1 )`, [req.body.appointment_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

// app.post('/updateTaskList', (req, res) => {
//   console.log('updateTaskList');

//   pool.query(`UPDATE nano_sales_package SET task = $1 WHERE sales_id = (SELECT id FROM nano_sales WHERE appointment_id = $2) `,
//     [req.body.task_list, req.body.id]).then((result) => {

//       return res.status(200).send({ success: true })

//     }).catch((error) => {
//       console.log(error)
//       return res.status(800).send({ success: false })
//     })

// }) 



// update TaskList
app.post('/updateTask', (req, res) => {
  console.log('updateTask');

  pool.query(`UPDATE nano_sales_package nsp SET  from_date = p.from_date FROM (
    SELECT 
     (r.value->>'from_date') AS from_date,
      (r.value->>'sap_id')::int AS sap_id FROM JSON_ARRAY_ELEMENTS($1::JSON) r
) p WHERE nsp.sap_id = p.sap_id  `, [req.body.task]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

//update to from_date2(json)
//updateTask2 no use ald
app.post('/updateTask2', (req, res) => {
  console.log('updateTask2');
  console.log(req.body)
  pool.query(`UPDATE nano_sales_package nsp SET from_date2 = p.from_date2::json FROM (
    SELECT 
     (r.value->>'from_date2') AS from_date2,
      (r.value->>'sap_id')::int AS sap_id FROM JSON_ARRAY_ELEMENTS($1::JSON) r
) p WHERE nsp.sap_id = p.sap_id  `, [req.body.task]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/updateTask3', (req, res) => {
  console.log('updateTask3');
  console.log(req.body)
  pool.query(`UPDATE nano_sales_package nsp SET from_date2 = p.from_date2::json, is_complaint = (p.is_complaint)::boolean, sub_completed = p.sub_completed::json FROM (
    SELECT 
     (r.value->>'from_date2') AS from_date2,
      (r.value->>'sap_id')::int AS sap_id,
      (r.value->>'is_complaint') AS is_complaint,
      (r.value->>'sub_completed') AS sub_completed FROM JSON_ARRAY_ELEMENTS($1::JSON) r
) p WHERE nsp.sap_id = p.sap_id  `, [req.body.task]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.post('/updateTask4', (req, res) => {
  console.log('updateTask4');
  // console.log(req.body)
  pool.query(`UPDATE nano_sales_package nsp SET 
  from_date2 = p.from_date2::json, is_complaint = (p.is_complaint)::boolean, sub_completed = p.sub_completed::json , from_date3 = p.from_date3::json
  FROM (
    SELECT 
     (r.value->>'from_date2') AS from_date2,
     (r.value->>'from_date3') AS from_date3,
      (r.value->>'sap_id')::int AS sap_id,
      (r.value->>'is_complaint') AS is_complaint,
      (r.value->>'sub_completed') AS sub_completed FROM JSON_ARRAY_ELEMENTS($1::JSON) r
) p WHERE nsp.sap_id = p.sap_id  `, [req.body.task]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/updateMaintenanceTask', (req, res) => {
  console.log('updateMaintenanceTask');
  pool.query(`UPDATE nano_sales_package nsp SET 
    from_date4 = p.from_date4::json, 
    maintain_status = p.maintain_status
    FROM (
      SELECT 
        (r.value->>'from_date4') AS from_date4,
        (r.value->>'sap_id')::int AS sap_id,
        (r.value->>'maintain_status') AS maintain_status
      FROM JSON_ARRAY_ELEMENTS($1::JSON) r
    ) p
    WHERE nsp.sap_id = p.sap_id
  `, [req.body.task])
    .then((result) => {
      return res.status(200).send({ success: true });
    })
    .catch((error) => {
      console.log(error);
      return res.status(800).send({ success: false });
    });
});

app.post('/updateSubMaintenanceTask', (req, res) => {
  console.log('updateSubMaintenanceTask');
  pool.query(`UPDATE nano_sales_package nsp SET 
    from_date4 = p.from_date4::json, 
    maintain_status = p.maintain_status
    FROM (
      SELECT 
        (r.value->>'from_date4') AS from_date4,
        (r.value->>'sap_id')::int AS sap_id,
        (r.value->>'maintain_status') AS maintain_status
      FROM JSON_ARRAY_ELEMENTS($1::JSON) r
    ) p
    WHERE nsp.sap_id = p.sap_id
  `, [req.body.task])
    .then((result) => {
      return res.status(200).send({ success: true });
    })
    .catch((error) => {
      console.log(error);
      return res.status(800).send({ success: false });
    });
});

//Payment
app.post('/getSalesPayment', (req, res) => {
  console.log('getSalesPayment');

  pool.query(`SELECT np.* , nu.user_name AS created_by FROM 
  nano_payment_log np LEFT JOIN nano_user nu ON np.created_by = nu.uid
  WHERE sales_id = (SELECT id FROM nano_sales WHERE appointment_id = $1)  `, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})
//Manage Promo
app.post('/updatePromo', (req, res) => {
  console.log('updatePromo');

  req.body.update_date = new Date().getTime()
  pool.query(`UPDATE nano_promo SET name = $1, percentage = $2, status = $3, update_date = $5 WHERE id = $4 `
    , [req.body.name, req.body.percentage, req.body.status, req.body.id, req.body.update_date]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/getSpecificPromo', (req, res) => {
  console.log('getSpecificPromo');

  req.body.update_date = new Date().getTime()
  pool.query(`SELECT * FROM nano_promo WHERE id = $1 `
    , [req.body.id]).then((result) => {

      return res.status(200).send({ data: result.rows[0], success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/createPromo', (req, res) => {
  console.log('createPromo');
  req.body.created_date = new Date().getTime()
  pool.query(`INSERT INTO nano_promo(name, percentage ,status, created_date) VALUES ($1, $2,true, $3)  `
    , [req.body.name, req.body.percentage, req.body.created_date]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})

app.get('/getPromo', (req, res) => {
  console.log('getPromo');

  pool.query(`SELECT * FROM nano_promo`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.get('/getActivePromo', (req, res) => {
  console.log('getActivePromo');

  pool.query(`SELECT * FROM nano_promo WHERE status = true`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})



// Manage discount
app.post('/updateDiscount', (req, res) => {
  console.log('updateDiscount');

  req.body.update_date = new Date().getTime()
  pool.query(`UPDATE nano_discount SET name = $1, percentage = $2, status = $3, need_photo = $6, update_date = $5 WHERE id = $4 `
    , [req.body.name, req.body.percentage, req.body.status, req.body.id, req.body.update_date, req.body.need_photo,]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/getSpecificDiscount', (req, res) => {
  console.log('getSpecificDiscount');

  req.body.update_date = new Date().getTime()
  pool.query(`SELECT * FROM nano_discount WHERE id = $1 `
    , [req.body.id]).then((result) => {

      return res.status(200).send({ data: result.rows[0], success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/createDiscount', (req, res) => {
  console.log('createDiscount');
  req.body.created_date = new Date().getTime()
  pool.query(`INSERT INTO nano_discount(name, percentage , need_photo,  status, created_date) VALUES ($1, $2, $3, true, $4)  `
    , [req.body.name, req.body.percentage, req.body.need_photo, req.body.created_date]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})

app.get('/getDiscount', (req, res) => {
  console.log('getDiscount');

  pool.query(`SELECT * FROM nano_discount`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.get('/getActiveDiscount', (req, res) => {
  console.log('getActiveDiscount');

  pool.query(`SELECT * FROM nano_discount WHERE status = true`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

//Manage Package


app.post('/createSalesPackages', (req, res) => {
  console.log('createSalesPackages');

  let datenow = new Date().getTime()
  pool.query(`INSERT INTO nano_packages (name, service, type, amount, status, created_at, min_sqft, max_sqft,
     sqft, area, job_type, maintenance, maintain_amount, maintain_date ) VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [req.body.package_name, req.body.service, req.body.type, req.body.amount, datenow, req.body.min_sqft,
    req.body.max_sqft, req.body.sqft, req.body.area, req.body.job_type, req.body.maintenance, req.body.maintain_amount, req.body.maintain_date]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false, err: error.message })
    })

})

app.post('/getSpecificSalesPackages', (req, res) => {
  console.log('getSpecificSalesPackages');


  pool.query(`SELECT * FROM nano_packages WHERE id = $1`,
    [req.body.package_id]).then((result) => {

      return res.status(200).send({ data: result.rows[0], success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false, err: error.message })
    })

})


app.post('/updatePackages', (req, res) => {
  console.log('updatePackages');

  pool.query(`UPDATE nano_packages SET(name, service, type, amount, min_sqft, max_sqft, sqft, area, status, job_type, maintenance, maintain_amount, maintain_date) = ($1, $2, $3, $4, $5, $6,
     $7, $8, $9, $10, $12, $13, $14) WHERE id = $11`,
    [req.body.package_name, req.body.service, req.body.type, req.body.amount, req.body.min_sqft, req.body.max_sqft, req.body.sqft, req.body.area,
    req.body.status, req.body.job_type, req.body.package_id, req.body.maintenance, req.body.maintain_amount, req.body.maintain_date]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false, err: error.message })
    })

})


app.post('/deleteSalesPackages', (req, res) => {
  console.log('deleteSalesPackages');


  pool.query(`UPDATE nano_packages status = $1 WHERE id = $2`,
    [req.body.status, req.body.package_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false, err: error.message })
    })

})

app.get('/getPackages', (req, res) => {
  console.log('getPackages')

  pool.query(`SELECT * FROM nano_packages`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getPackagesByDetail', (req, res) => {
  console.log('getPackagesByDetail')

  pool.query(`SELECT * FROM nano_packages where service = $1 AND min_sqft = $2 AND max_sqft = $3 AND type = $4`, [req.body.service, req.body.min_sqft, req.body.max_sqft, req.body.type]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getPackagesByPackageId', (req, res) => {
  console.log('getPackagesByPackageId')

  pool.query(`SELECT * FROM nano_packages WHERE id = $1`, [req.body.pid]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

// Manage label
app.post('/updateLabel', (req, res) => {
  console.log('updateLabel');

  req.body.update_date = new Date().getTime()
  pool.query(`UPDATE nano_label SET name = $1, colour = $2, status = $3, update_date = $5 WHERE id = $4`
    , [req.body.name, req.body.colour, req.body.status, req.body.id, req.body.update_date]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

//update main label
app.post('/updateMainLabel', (req, res) => {
  console.log('updateMainLabel');

  req.body.update_date = new Date().getTime()
  pool.query(`WITH updatelabel as (UPDATE nano_label SET name = $1, category = $1, colour = $2, status = $3, update_date = $5 WHERE id = $4 RETURNING *),
  updatecategory as (UPDATE nano_label SET category = $1 WHERE category LIKE $6)
  SELECT * from updatelabel`
    , [req.body.name, req.body.colour, req.body.status, req.body.id, req.body.update_date, req.body.labelorigin]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/getSpecificLabel', (req, res) => {
  console.log('getSpecificLabel');

  req.body.update_date = new Date().getTime()
  pool.query(`SELECT * FROM nano_label WHERE id = $1 `
    , [req.body.id]).then((result) => {

      return res.status(200).send({ data: result.rows[0], success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})



app.post('/createLabel', (req, res) => {
  console.log('createLabel');
  req.body.created_date = new Date().getTime()
  pool.query(`INSERT INTO nano_label(name, colour , status, created_date, category,main) VALUES ($1, $2, true, $3, $4, $5)  `
    , [req.body.name, req.body.colour, req.body.created_date, req.body.category, req.body.main]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.get('/getLabel', (req, res) => {
  console.log('getLabel');

  pool.query(`SELECT * FROM nano_label WHERE status = true ORDER BY category `).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

//NANO app sales exec mobile
app.post('/updateLeadEmail', (req, res) => {
  console.log('updateLeadEmail');

  pool.query(`UPDATE nano_leads SET customer_email = $1 WHERE id = $2`, [req.body.email, req.body.lead_id]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false, err: error.message })
  })

})



// nano_sales_discount
app.post('/getAllSalesDiscount', (req, res) => {
  console.log('getAllSalesDiscount');

  pool.query(`SELECT * FROM nano_sales_discount WHERE sales_id = $1 AND status = true`, [req.body.sales_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/deleteSalesDiscount', (req, res) => {
  console.log('deleteSalesDiscount');
  req.body.photo = JSON.stringify([])
  pool.query(` DELETE FROM nano_sales_discount WHERE id = $1`,
    [req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updatePhotoForSalesDiscount', (req, res) => {
  console.log('updatePhotoForSalesDiscount')
  pool.query(`UPDATE nano_sales_discount SET photo = $1 WHERE id = $2`,
    [req.body.photo, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


app.post('/AddNewSalesDiscountWritten', (req, res) => {
  console.log('AddNewSalesDiscountWritten');
  req.body.photo = JSON.stringify([])
  pool.query(`
  INSERT INTO nano_sales_discount (name, remark, percentage, need_photo, photo, sales_id, discount_id, type, status)
  VALUES($1, $2, $3, $4, $5, $6, $7, $8, true)`,
    [req.body.name, req.body.remark, req.body.percentage, req.body.need_photo, req.body.photo, req.body.sales_id, req.body.discount_id,
    req.body.type]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/addTickSalesDiscount', async (req, res) => {
  console.log('addTickSalesDiscount')

  if (req.body.body.discount.length > 0) {
    let arr = await req.body.body.discount.map(e => JSON.parse(JSON.stringify(Object.keys(e).sort().reduce((r, k) => (r[k] = e[k], r), {}))))
    let body = Object.entries(arr[0])
    let variables = body.map(e => e[0]).join(',')
    let values2 = await arr.map(e => (Object.values(e).map((a, i) => a)))

    pool.query(format(`INSERT INTO nano_sales_discount(` + variables + `) 
    VALUES %L  ON CONFLICT(discount_id, sales_id) DO UPDATE SET status = excluded.status`, values2), []).then((result) => {

      pool.query(`UPDATE nano_sales_discount nsl SET status = p.status FROM (
        SELECT (r.value->>'discount_id')::bigint AS discount_id,
        (r.value->>'sales_id')::bigint AS sales_id,
        (r.value->>'status')::boolean AS status
        FROM JSONB_ARRAY_ELEMENTS($1::JSONB) r
    ) p WHERE nsl.discount_id = p.discount_id AND nsl.sales_id = p.sales_id `, [req.body.false]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  } else {
    pool.query(`UPDATE nano_sales_discount nsl SET status = p.status FROM (
      SELECT (r.value->>'discount_id')::bigint AS discount_id,
      (r.value->>'sales_id')::bigint AS sales_id,
      (r.value->>'status')::boolean AS status
      FROM JSONB_ARRAY_ELEMENTS($1::JSONB) r
  ) p WHERE nsl.discount_id = p.discount_id AND nsl.sales_id = p.sales_id `, [req.body.false]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

  }




})




// Manage Schedule
app.get('/getAllSchedule', (req, res) => {
  console.log('getAllSchedule');

  pool.query(`SELECT * FROM nano_schedule WHERE status = true`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})



app.post('/getAllScheduleByUid', (req, res) => {
  console.log('getAllScheduleByUid');

  pool.query(`SELECT nsl.* FROM nano_schedule nsl LEFT JOIN nano_sales ns ON nsl.sales_id = ns.id 
  LEFT JOIN nano_appointment na ON ns.appointment_id = na.id WHERE exists(select * from json_array_elements_text(na.assigned_to4) as ppl where ppl = $1 ) ORDER BY schedule_date DESC`, [req.body.uid]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.post('/getAllScheduleBySales', (req, res) => {
  console.log('getAllScheduleBySales');

  // pool.query(`SELECT * FROM nano_schedule WHERE sales_id = $1 AND status = true`, [req.body.sales_id]).then((result) => {
  pool.query(`SELECT * FROM nano_schedule WHERE sales_id = $1 AND status = true`, [req.body.sales_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

// (SELECT JSON_AGG(JSON_BUILD_OBJECT('date', from_date)) FROM nano_sales_package nsp WHERE nsp.sales_id = b.id AND from_date IS NOT NULL) as install_date
app.post('/getScheduleByDate', (req, res) => {
  console.log('getScheduleByDate');

  pool.query(`SELECT a.*, c.customer_name, c.customer_phone, c.address, b.subcon_state, b.lead_id,

  (SELECT JSON_AGG(user_name)
  FROM nano_user
  WHERE uid IN (
      SELECT jsonb_array_elements_text(assigned_to4::jsonb)
      FROM nano_appointment WHERE id = (SELECT appointment_id FROM nano_sales ns WHERE ns.id = b.id)
  ))  AS assign_se,

  (SELECT JSON_AGG(user_name) 
            FROM nano_user 
            WHERE uid IN (SELECT value::text 
                           FROM JSONB_ARRAY_ELEMENTS_TEXT(na.assigned_to4::JSONB))) AS user_name
  FROM nano_schedule a 
  LEFT JOIN nano_sales b ON a.sales_id = b.id 
  LEFT JOIN nano_leads c ON b.lead_id = c.id 
  LEFT JOIN nano_appointment na ON na.id = (SELECT appointment_id FROM nano_sales ns WHERE ns.id = b.id)
  WHERE b.subcon_state IS NULL AND a.schedule_date >= $1 AND a.schedule_date <= $2 AND a.status = true ORDER BY a.created_date DESC`, [req.body.minimum, req.body.maximum]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getScheduleByDateApp', (req, res) => {
  console.log('getScheduleByDateApp');

  pool.query(`SELECT a.*, c.customer_name, c.customer_phone, c.address, b.subcon_state, b.lead_id,
  (na.assigned_to4::text) as user_uid,

  (SELECT JSON_AGG(user_name)
  FROM nano_user
  WHERE uid IN (
      SELECT jsonb_array_elements_text(assigned_to4::jsonb)
      FROM nano_appointment WHERE id = (SELECT appointment_id FROM nano_sales ns WHERE ns.id = b.id)
  ))  AS assign_se,

  (SELECT JSON_AGG(user_name) 
            FROM nano_user 
            WHERE uid IN (SELECT value::text 
                           FROM JSONB_ARRAY_ELEMENTS_TEXT(na.assigned_to4::JSONB))) AS user_name
  FROM nano_schedule a 
  LEFT JOIN nano_sales b ON a.sales_id = b.id 
  LEFT JOIN nano_leads c ON b.lead_id = c.id 
  LEFT JOIN nano_appointment na ON na.id = (SELECT appointment_id FROM nano_sales ns WHERE ns.id = b.id)
  WHERE a.schedule_date >= $1 AND a.schedule_date <= $2 AND a.status = true ORDER BY a.created_date DESC`, [req.body.minimum, req.body.maximum]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getScheduleByDatePM', (req, res) => {
  console.log('getScheduleByDatePM');

  const query = `
    SELECT a.*, 
      c.customer_name, 
      c.customer_phone, 
      c.address, 
      b.subcon_state, 
      b.lead_id,
      COALESCE(
        (SELECT JSON_AGG(nu.user_name)
         FROM nano_user nu
         WHERE nu.uid IN (
           SELECT jsonb_array_elements_text(na.assigned_to4::jsonb)
           FROM nano_appointment na
           WHERE na.id = (
             SELECT appointment_id 
             FROM nano_sales ns 
             WHERE ns.id = b.id
           )
         )
        ), '[]') AS assign_se,
      COALESCE(
        (SELECT JSON_AGG(nu.user_name)
         FROM nano_user nu
         WHERE nu.uid IN (
           SELECT jsonb_array_elements_text(na.assigned_to4::jsonb)
         )
        ), '[]') AS user_name
    FROM nano_schedule a
    LEFT JOIN nano_sales b ON a.sales_id = b.id
    LEFT JOIN nano_leads c ON b.lead_id = c.id
    LEFT JOIN nano_appointment na ON na.id = (
      SELECT appointment_id 
      FROM nano_sales ns 
      WHERE ns.id = b.id
    )
    WHERE 
      b.subcon_state IS NULL
      AND a.schedule_date >= $1
      AND a.schedule_date <= $2
      AND a.status = true
      AND b.pending_subcon = $3::text
    ORDER BY a.created_date DESC;
  `;

  pool.query(query, [req.body.minimum, req.body.maximum, req.body.company])
    .then((result) => {
      return res.status(200).send({ data: result.rows, success: true });
    })
    .catch((error) => {
      console.error(error);
      return res.status(800).send({ success: false });
    });
});


app.post('/getScheduleByDatePA', (req, res) => {
  console.log('getScheduleByDatePA');

  pool.query(`SELECT a.*, c.customer_name, c.customer_phone, c.address, b.subcon_state, b.lead_id,

  (SELECT JSON_AGG(user_name)
  FROM nano_user
  WHERE uid IN (
      SELECT jsonb_array_elements_text(assigned_to4::jsonb)
      FROM nano_appointment WHERE id = (SELECT appointment_id FROM nano_sales ns WHERE ns.id = b.id)
  ))  AS assign_se,

  (SELECT JSON_AGG(user_name) 
            FROM nano_user 
            WHERE uid IN (SELECT value::text 
                           FROM JSONB_ARRAY_ELEMENTS_TEXT(na.assigned_to4::JSONB))) AS user_name
  FROM nano_schedule a 
  LEFT JOIN nano_sales b ON a.sales_id = b.id 
  LEFT JOIN nano_leads c ON b.lead_id = c.id 
  LEFT JOIN nano_appointment na ON na.id = (SELECT appointment_id FROM nano_sales ns WHERE ns.id = b.id)
  WHERE b.subcon_state IS NULL AND a.schedule_date >= $1 AND a.schedule_date <= $2 AND a.status = true AND $3::text IS NOT NULL ORDER BY a.created_date DESC`, [req.body.minimum, req.body.maximum, req.body.company]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getScheduleByDateForList', (req, res) => {
  console.log('getScheduleByDateForList');

  pool.query(`SELECT a.schedule_date,a.sales_id
  FROM nano_schedule a LEFT JOIN nano_sales b ON a.sales_id = b.id LEFT JOIN nano_leads c ON b.lead_id = c.id 
  WHERE b.subcon_state IS NULL AND a.schedule_date >= $1 AND a.schedule_date <= $2 AND a.status = true ORDER BY a.created_date DESC`, [req.body.minimum, req.body.maximum]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getScheduleByDateForListApp', (req, res) => {
  console.log('getScheduleByDateForListApp');

  pool.query(`SELECT a.schedule_date, a.sales_id, (na.assigned_to4::text) as user_uid
  FROM nano_schedule a 
  LEFT JOIN nano_sales b ON a.sales_id = b.id 
  LEFT JOIN nano_leads c ON b.lead_id = c.id 
  LEFT JOIN nano_appointment na ON na.id = b.appointment_id
  WHERE a.schedule_date >= $1 AND a.schedule_date <= $2 AND a.status = true ORDER BY a.created_date DESC`, [req.body.minimum, req.body.maximum]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getScheduleByDateForList2', (req, res) => {
  console.log('getScheduleByDateForList2');

  pool.query(`SELECT a.schedule_date,a.sales_id
  FROM nano_schedule a LEFT JOIN nano_sales b ON a.sales_id = b.id LEFT JOIN nano_leads c ON b.lead_id = c.id 
  WHERE b.subcon_state IS NULL AND a.schedule_date >= $1 AND a.schedule_date <= $2 AND a.status = true AND b.subcon_state IS NOT NULL ORDER BY a.created_date DESC`, [req.body.minimum, req.body.maximum]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getScheduleByDateForListPM', (req, res) => {
  console.log('getScheduleByDateForListPM');

  pool.query(`SELECT a.schedule_date,a.sales_id
  FROM nano_schedule a LEFT JOIN nano_sales b ON a.sales_id = b.id LEFT JOIN nano_leads c ON b.lead_id = c.id 
  WHERE b.subcon_state IS NULL AND a.schedule_date >= $1 AND a.schedule_date <= $2 AND a.status = true AND b.subcon_state IS NOT NULL AND b.pending_subcon = $3::text
  ORDER BY a.created_date DESC`, [req.body.minimum, req.body.maximum, req.body.company]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getScheduleByDateForListPA', (req, res) => {
  console.log('getScheduleByDateForListPA');

  pool.query(`SELECT a.schedule_date,a.sales_id
  FROM nano_schedule a LEFT JOIN nano_sales b ON a.sales_id = b.id LEFT JOIN nano_leads c ON b.lead_id = c.id 
  WHERE b.subcon_state IS NULL AND a.schedule_date >= $1 AND a.schedule_date <= $2 AND a.status = true AND b.subcon_state IS NOT NULL AND $3::text IS NOT NULL AND b.final_approval = true
  ORDER BY a.created_date DESC`, [req.body.minimum, req.body.maximum, req.body.company]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getFromDateByDate', (req, res) => {
  console.log('getFromDateByDate');

  pool.query(`SELECT nsp.*, nsp.from_date as schedule_date, nsp.from_date2 as schedule_date2,c.customer_name, c.customer_phone, c.address, b.subcon_state, b.lead_id,

  (SELECT JSON_AGG(user_name)
  FROM nano_user
  WHERE uid IN (
      SELECT jsonb_array_elements_text(assigned_to4::jsonb)
      FROM nano_appointment WHERE id = (SELECT appointment_id FROM nano_sales ns WHERE ns.id = b.id)
  ))  AS assign_se

  FROM nano_sales_package nsp 
  LEFT JOIN nano_sales b ON nsp.sales_id = b.id 
  LEFT JOIN nano_leads c ON b.lead_id = c.id  
  WHERE 
  (nsp.from_date IS NOT NULL AND (nsp.from_date >= $1 AND nsp.from_date <= $2)) 
  OR (EXISTS(SELECT 1 FROM jsonb_array_elements_text(nsp.from_date2::jsonb) AS time WHERE time::bigint >= $1::bigint AND time::bigint <= $2::bigint))
  `, [req.body.minimum, req.body.maximum]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getFromDateByDate2', (req, res) => {
  console.log('getFromDateByDate2');

  pool.query(`
  WITH act1 AS (
    SELECT nsp.*, b.subcon_state, b.lead_id, nsp.from_date as schedule_date, ns.schedule_date as schedule_real, nsp.from_date2 as schedule_date2, JSON_AGG(ns.remark) as remark2, ns.created_by, ns.id, ns.status as schedule_status, c.customer_name, c.customer_phone, c.address, b.final_approval, (na.assigned_to4::text) as user_uid,
    (SELECT JSON_AGG(user_name) FROM nano_user WHERE uid IN (SELECT jsonb_array_elements_text(assigned_to4::jsonb) FROM nano_appointment WHERE id = (SELECT appointment_id FROM nano_sales ns WHERE ns.id = b.id))) AS assign_se,
    b.assigned_worker
    FROM nano_sales_package nsp 
    LEFT JOIN nano_sales b ON nsp.sales_id = b.id 
    LEFT JOIN nano_leads c ON b.lead_id = c.id 
    LEFT JOIN nano_schedule ns ON ns.sales_id = nsp.sales_id 
    LEFT JOIN nano_appointment na ON na.id = (SELECT appointment_id FROM nano_sales ns WHERE ns.id = nsp.sales_id)
    GROUP BY nsp.sap_id, b.subcon_state, b.lead_id, c.customer_name, c.customer_phone, c.address, b.final_approval, ns.id, ns.created_by, na.assigned_to4::text, b.id, ns.status, ns.schedule_date
  ),
  act2 AS (
    SELECT a.*, (
      SELECT JSON_AGG(JSON_BUILD_OBJECT('uid', w.value ->> 'uid', 'user_name', u.user_name, 'role', w.value ->> 'role'))
      FROM JSONB_ARRAY_ELEMENTS(a.assigned_worker::jsonb) w
      LEFT JOIN nano_user u ON u.uid = w.value ->> 'uid'
    ) AS assigned_worker_info,
    (SELECT JSON_AGG(user_name) FROM nano_user WHERE uid IN (SELECT value::text FROM JSONB_ARRAY_ELEMENTS_TEXT(a.user_uid::JSONB))) AS user_name
    FROM act1 a
  )
  SELECT * FROM act2 
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(act2.schedule_date2::jsonb) AS date 
    WHERE date::bigint >= $1 AND date::bigint <= $2
  )`, [req.body.minimum, req.body.maximum])
    .then((result) => {
      return res.status(200).send({ data: result.rows, success: true });
    })
    .catch((error) => {
      console.log(error);
      return res.status(800).send({ success: false });
    });
});



app.post('/getFromDateByDatePM', (req, res) => {
  console.log('getFromDateByDatePM');

  const query = `
    WITH act1 AS (
      SELECT 
        nsp.*, 
        b.subcon_state, 
        b.lead_id, 
        nsp.from_date AS schedule_date,
        nsp.from_date2 AS schedule_date2, 
        JSON_AGG(ns.remark) AS remark2, 
        c.customer_name, 
        c.customer_phone, 
        c.address, 
        b.final_approval, 
        b.pending_subcon, 
        b.sub_cust_sign AS sales_cust_sign, 
        sf.*,
        na.assigned_to4::text AS user_uid, 
        c.id AS lead_id2, 
        b.is_postpone, 
        JSON_AGG(
          DISTINCT jsonb_build_object('uid', aw.uid, 'role', aw.role, 'name', su.user_name)
        ) AS assigned_worker
      FROM 
        nano_sales_package nsp
      LEFT JOIN 
        nano_sales b ON nsp.sales_id = b.id 
      LEFT JOIN 
        nano_leads c ON b.lead_id = c.id 
      LEFT JOIN 
        nano_schedule ns ON ns.sales_id = nsp.sales_id 
      LEFT JOIN 
        nano_appointment na ON na.id = (
          SELECT appointment_id 
          FROM nano_sales ns 
          WHERE ns.id = nsp.sales_id
        )
      LEFT JOIN 
        subcon_service_form sf ON sf.sales_id = nsp.sales_id
      LEFT JOIN 
        LATERAL (
          SELECT aw->>'uid' AS uid, aw->>'role' AS role
          FROM jsonb_array_elements(COALESCE(b.assigned_worker::jsonb, '[]'::jsonb)) AS aw
          WHERE aw->>'uid' IS NOT NULL
        ) aw ON TRUE
      LEFT JOIN 
        sub_user su ON su.uid = aw.uid
      GROUP BY 
        nsp.sap_id, b.subcon_state, b.lead_id, c.customer_name, c.customer_phone, 
        c.address, b.final_approval, b.pending_subcon, b.sub_cust_sign, 
        sf.id, na.assigned_to4::text, c.id, b.is_postpone
    ), 
    act2 AS (
      SELECT 
        a.*,
        (SELECT JSON_AGG(user_name) 
         FROM nano_user 
         WHERE uid IN (
           SELECT value::text 
           FROM JSONB_ARRAY_ELEMENTS_TEXT(a.user_uid::JSONB)
         )
        ) AS user_name
      FROM act1 a
    )
    SELECT * 
    FROM act2 
    WHERE 
      EXISTS (
        SELECT 1 
        FROM jsonb_array_elements_text(act2.schedule_date2::jsonb) AS date 
        WHERE date::bigint >= $1 AND date::bigint <= $2
      )
      AND act2.pending_subcon = $3
    ORDER BY schedule_date DESC
  `;

  pool.query(query, [req.body.minimum, req.body.maximum, req.body.company])
    .then((result) => {
      return res.status(200).send({ data: result.rows, success: true });
    })
    .catch((error) => {
      console.error(error);
      return res.status(800).send({ success: false });
    });
});


app.post('/getFromDateByDatePA', (req, res) => {
  console.log('getFromDateByDatePA');

  pool.query(`WITH act1 AS (
    SELECT nsp.*, b.subcon_state, b.lead_id, nsp.from_date as schedule_date,
    nsp.from_date2 as schedule_date2, json_agg(ns.remark) as remark2, 
    c.customer_name, c.customer_phone, c.address, c.customer_name, b.final_approval, b.pending_subcon, b.sub_cust_sign as sales_cust_sign, sf.*,
    (na.assigned_to4::text) as user_uid, c.id as lead_id2, b.is_postpone, JSON_AGG(DISTINCT jsonb_build_object('uid', aw.uid, 'role', aw.role, 'name', su.user_name)) AS assigned_worker
    FROM nano_sales_package nsp 
    LEFT JOIN nano_sales b ON nsp.sales_id = b.id 
    LEFT JOIN nano_leads c ON b.lead_id = c.id 
    LEFT JOIN nano_schedule ns ON ns.sales_id = nsp.sales_id 
    LEFT JOIN nano_appointment na ON na.id = (SELECT appointment_id FROM nano_sales ns WHERE ns.id = nsp.sales_id)
    LEFT JOIN subcon_service_form sf ON sf.sales_id = nsp.sales_id
    LEFT JOIN 
LATERAL (
  SELECT aw->>'uid' AS uid, aw->>'role' AS role
  FROM jsonb_array_elements(COALESCE(b.assigned_worker::jsonb, '[]'::jsonb)) AS aw
  WHERE aw->>'uid' IS NOT NULL
) aw ON TRUE
LEFT JOIN sub_user su ON su.uid = aw.uid
WHERE b.final_approval = true
    GROUP BY nsp.sap_id, b.subcon_state, b.lead_id, c.customer_name, c.customer_phone, c.address, b.final_approval, b.pending_subcon, b.sub_cust_sign, sf.id,
     na.assigned_to4::text, c.id, b.is_postpone
  ) , 
  act2 AS (
    SELECT a.*,
    (SELECT JSON_AGG(user_name) 
      FROM nano_user 
      WHERE uid IN (SELECT value::text 
      FROM JSONB_ARRAY_ELEMENTS_TEXT(a.user_uid::JSONB))) AS user_name
    FROM act1 a
  )
  SELECT * 
    FROM act2 
    WHERE EXISTS (
      SELECT 1 
      FROM jsonb_array_elements_text(act2.schedule_date2::jsonb) AS date 
      WHERE date::bigint >= $1 AND date::bigint <= $2
    ) AND $3::text IS NOT NULL
  `, [req.body.minimum, req.body.maximum, req.body.company]).then((result) => {
    // (nsp.from_date >= $1 AND nsp.from_date <= $2))
    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getFromDateByDateForList', (req, res) => {
  console.log('getFromDateByDateForList');

  pool.query(`SELECT nsp.sales_id, nsp.from_date as schedule_date, nsp.from_date2 as schedule_date2
  FROM nano_sales_package nsp LEFT JOIN nano_sales b ON nsp.sales_id = b.id LEFT JOIN nano_leads c ON b.lead_id = c.id  
  WHERE (nsp.from_date IS NOT NULL AND (nsp.from_date >= $1 AND nsp.from_date <= $2)) 
  OR (EXISTS(SELECT 1 FROM jsonb_array_elements_text(nsp.from_date2::jsonb) AS time WHERE time::bigint >= $1::bigint AND time::bigint <= $2::bigint))
  `, [req.body.minimum, req.body.maximum]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getFromDateByDateForList2', (req, res) => {
  console.log('getFromDateByDateForList2');

  pool.query(`SELECT nsp.sales_id, nsp.from_date as schedule_date, nsp.from_date2 as schedule_date2
  FROM nano_sales_package nsp LEFT JOIN nano_sales b ON (nsp.sales_id = b.id AND b.subcon_state IS NOT NULL) LEFT JOIN nano_leads c ON b.lead_id = c.id  
  WHERE ((nsp.from_date IS NOT NULL AND (nsp.from_date >= $1 AND nsp.from_date <= $2)) 
  OR (EXISTS(SELECT 1 FROM jsonb_array_elements_text(nsp.from_date2::jsonb) AS time WHERE time::bigint >= $1::bigint AND time::bigint <= $2::bigint))) AND b.subcon_state IS NOT NULL
  `, [req.body.minimum, req.body.maximum]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getFromDateByDateForListPM', (req, res) => {
  console.log('getFromDateByDateForListPM');

  pool.query(`SELECT nsp.sales_id, nsp.from_date as schedule_date, nsp.from_date2 as schedule_date2
  FROM nano_sales_package nsp LEFT JOIN nano_sales b ON (nsp.sales_id = b.id AND b.subcon_state IS NOT NULL) LEFT JOIN nano_leads c ON b.lead_id = c.id  
  WHERE ((nsp.from_date IS NOT NULL AND (nsp.from_date >= $1 AND nsp.from_date <= $2)) 
  OR (EXISTS(SELECT 1 FROM jsonb_array_elements_text(nsp.from_date2::jsonb) AS time WHERE time::bigint >= $1::bigint AND time::bigint <= $2::bigint))) AND b.subcon_state IS NOT NULL AND b.pending_subcon = $3::text
  `, [req.body.minimum, req.body.maximum, req.body.company]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getFromDateByDateForListPA', (req, res) => {
  console.log('getFromDateByDateForListPA');

  pool.query(`SELECT nsp.sales_id, nsp.from_date as schedule_date, nsp.from_date2 as schedule_date2
  FROM nano_sales_package nsp LEFT JOIN nano_sales b ON (nsp.sales_id = b.id AND b.subcon_state IS NOT NULL) LEFT JOIN nano_leads c ON b.lead_id = c.id  
  WHERE ((nsp.from_date IS NOT NULL AND (nsp.from_date >= $1 AND nsp.from_date <= $2) AND b.final_approval = true) 
  OR (EXISTS(SELECT 1 FROM jsonb_array_elements_text(nsp.from_date2::jsonb) AS time WHERE time::bigint >= $1::bigint AND time::bigint <= $2::bigint))) AND b.subcon_state IS NOT NULL
  AND $3::text IS NOT NULL`, [req.body.minimum, req.body.maximum, req.body.company]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getFromDateBySearch', (req, res) => {
  console.log('getFromDateBySearch');

  pool.query(`SELECT nsp.*, nsp.from_date as schedule_date, nsp.from_date2 as schedule_date2, c.customer_name, c.customer_phone, c.address, b.subcon_state FROM nano_sales_package nsp LEFT JOIN nano_sales b ON nsp.sales_id = b.id LEFT JOIN nano_leads c ON b.lead_id = c.id  
  WHERE (nsp.from_date IS NOT NULL OR nsp.from_date2::text != '[]') AND (LOWER(customer_name) ILIKE $1 OR LOWER(customer_phone) ILIKE $1)
  `, ['%' + req.body.keyword + '%']).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getScheduleBySearch', (req, res) => {
  console.log('getScheduleBySearch');

  pool.query(`SELECT a.*, c.customer_name, c.customer_phone, c.address, b.subcon_state
  FROM nano_schedule a LEFT JOIN nano_sales b ON a.sales_id = b.id LEFT JOIN nano_leads c ON b.lead_id = c.id 
  WHERE b.subcon_state IS NULL AND a.status = true AND (LOWER(customer_name) ILIKE $1 OR LOWER(customer_phone) ILIKE $1) ORDER BY a.created_date DESC`, ['%' + req.body.keyword + '%']).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getSpecificSchedule', (req, res) => {
  console.log('getSpecificSchedule');

  pool.query(`SELECT * FROM nano_schedule WHERE id = $1`, [req.body.schedule_id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/createSchedule', (req, res) => {
  console.log('createSchedule');
  req.body.createdDate = new Date().getTime()
  pool.query(`INSERT INTO nano_schedule(sales_id, schedule_date, created_date, status, remark, created_by, approve_status) VALUES($1, $2, $3,true, $4, $5, null)`,
    [req.body.sales_id, req.body.schedule_date, req.body.created_date, req.body.remark, req.body.uid]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/createSchedule2', (req, res) => {
  console.log('createSchedule2');
  req.body.createdDate = new Date().getTime()
  pool.query(`
  SELECT user_name FROM nano_user WHERE uid = $1
`, [req.body.uid]).then((result) => {
    let by = result.rows[0]['user_name']
    pool.query(`WITH insertschedule as (INSERT INTO nano_schedule(sales_id, schedule_date, created_date, status, remark, created_by, approve_status, schedule_kiv) VALUES($1, $2, $3,true, $4, $5, null, $11) RETURNING id),
  insertactivitylog as (INSERT INTO nano_activity_log (lead_id, appointment_id, sales_id, activity_time, activity_by, remark, activity_type) 
  VALUES($6, $7, $1, $8, $5, $9, $10))
  SELECT * FROM insertschedule`,
      [req.body.sales_id, req.body.schedule_date, req.body.created_date, req.body.remark, req.body.uid, req.body.leadid, req.body.aid, req.body.createdDate, 'Schedule Created by ' + by, 'Schedule', req.body.kiv]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ error: error.message, success: false })
      })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})

app.post('/createSchedule3', (req, res) => {
  console.log('createSchedule3');
  req.body.createdDate = new Date().getTime()
  pool.query(`
  SELECT user_name FROM nano_user WHERE uid = $1
`, [req.body.uid]).then((result) => {
    let by = result.rows[0]['user_name']
    pool.query(`WITH insertschedule as (INSERT INTO nano_schedule(sales_id, schedule_date, created_date, status, remark, created_by, approve_status, schedule_kiv, is_maintain) VALUES($1, $2, $3,true, $4, $5, null, $11, $12) RETURNING id),
  insertactivitylog as (INSERT INTO nano_activity_log (lead_id, appointment_id, sales_id, activity_time, activity_by, remark, activity_type) 
  VALUES($6, $7, $1, $8, $5, $9, $10))
  SELECT * FROM insertschedule`,
      [req.body.sales_id, req.body.schedule_date, req.body.created_date, req.body.remark, req.body.uid, req.body.leadid, req.body.aid, req.body.createdDate, 'Schedule Created by ' + by, 'Schedule', req.body.kiv, req.body.is_maintain]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ error: error.message, success: false })
      })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})

app.post('/updateScheduleRemark', (req, res) => {
  console.log('updateScheduleRemark');
  console.log(req.body);
  req.body.createdDate = new Date().getTime()
  pool.query(`UPDATE nano_schedule SET remark = $2, schedule_date = $3 WHERE id = $1 AND (approve_status = false OR approve_status IS null) RETURNING id`,
    [req.body.schedule_id, req.body.remark, req.body.from_date]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/updateScheduleRemark2', (req, res) => {
  console.log('updateScheduleRemark2');
  req.body.createdDate = new Date().getTime()
  pool.query(`
  SELECT user_name FROM nano_user WHERE uid = $1
`, [req.body.uid]).then((result) => {
    let by = result.rows[0]['user_name']
    pool.query(`WITH updateschedule as (UPDATE nano_schedule SET remark = $2, schedule_date = $3, schedule_kiv = $11 WHERE id = $1 AND (approve_status = false OR approve_status IS null) RETURNING id),
  insertactivitylog as (INSERT INTO nano_activity_log (lead_id, appointment_id, sales_id, activity_time, activity_by, remark, activity_type) 
  VALUES($4, $5, $6, $7, $8, $9, $10))
  SELECT * FROM updateschedule`,
      [req.body.schedule_id, req.body.remark, req.body.from_date, req.body.leadid, req.body.aid, req.body.sales_id, req.body.createdDate, req.body.uid, 'Schedule Updated by ' + by, 'Schedule', req.body.kiv]).then((result) => {

        return res.status(200).send({ data: result.rows, success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ error: error.message, success: false })
      })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})

app.post('/removeSchedule', (req, res) => {
  console.log('removeSchedule');
  req.body.createdDate = new Date().getTime()
  pool.query(`UPDATE nano_schedule SET status = $2 WHERE id = $1 AND (approve_status = false OR approve_status IS null) RETURNING id`,
    [req.body.schedule_id, req.body.status]).then((result) => {

      return res.status(200).send({ data: result.rows[0], success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})
app.post('/updateLeadDetails', (req, res) => {

  console.log('updateLeadDetails');
  pool.query(`UPDATE nano_leads SET (label_s, label_m) = ($1, $2) WHERE id = $3`,
    [req.body.label_s, req.body.label_m, req.body.lead_id]).then((result) => {
      req.body.activity_time = new Date().getTime()
      pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`, [req.body.uid]).then((result) => {
        req.body.activity_type = 'Update Lead'
        let by = result.rows[0]['user_name']
        pool.query(`INSERT INTO nano_activity_log(lead_id, activity_time, activity_by, remark, activity_type) VALUES($1, $2, $3, $4, $5)`,
          [req.body.lead_id, req.body.activity_time, req.body.uid, 'Appointment Updated By ' + by, 'Lead']).then((result) => {

            return res.status(200).send({ success: true })

          }).catch((error) => {
            console.log(error)
            return res.status(800).send({ error: error.message, success: false })
          })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ error: error.message, success: false })
      })


    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

// manage promo
app.post('/checkPromoCode', (req, res) => {
  console.log('checkPromoCode');
  req.body.createdDate = new Date().getTime()
  pool.query(`SELECT * FROM nano_promo WHERE name = $1`,
    [req.body.name]).then((result) => {

      return res.status(200).send({ data: result.rows[0], success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

//get PLACE
app.get('/getAllPlace', (req, res) => {
  console.log('getAllPlace');

  pool.query(`SELECT * FROM nano_place WHERE status = true ORDER BY created_date`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})





app.post('/getSalesExec', (req, res) => {
  console.log('getSalesExec');

  pool.query(`SELECT * FROM nano_user WHERE uid = $1`, [req.body.uid]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/updateSalesExec', (req, res) => {
  console.log('updateSalesExec');

  pool.query(`UPDATE nano_user SET (user_name, user_phone_no, user_address, profile_image, user_state) = ($1, $2, $3, $4,$6) WHERE uid = $5`, [req.body.name, req.body.phone, req.body.address, req.body.image, req.body.uid, req.body.state]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.get('/getAllSalesExec', (req, res) => {
  console.log('getAllSalesExec');

  pool.query(`SELECT * FROM nano_user`).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/checkPaymentLog', (req, res) => {
  console.log('checkPaymentLog');

  pool.query(`SELECT * FROM nano_payment_log WHERE sales_id = $1`, [req.body.sales_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/checkPaymentLogId', (req, res) => {
  console.log('checkPaymentLogId');

  pool.query(`SELECT * FROM nano_payment_log WHERE id = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

//  JSON_AGG(json_build_object('check_id', nc.no, 'check_lat', nc.check_lat, 'check_long', nc.check_long, 'check_time', nc.check_time, 'check_address', nc.check_address, 'check_remark', nc.check_remark, 'check_status', nc.check_status))

//* ami
app.post('/getAppointmentDetails2', (req, res) => {
  console.log('getAppointmentDetails2')
  pool.query(`SELECT nsp.from_date, nsp.from_date2 FROM nano_appointment a LEFT JOIN nano_sales ns ON a.id = ns.appointment_id LEFT JOIN nano_sales_package nsp ON nsp.sales_id = ns.id WHERE a.id = $1`, [req.body.id]).then(result => {

    let temp = result['rows'][0]['from_date']
    // let temp2 = result['rows'][0]['from_date2'] 

    if (temp == null) {
      pool.query(`SELECT a.id AS appointment_id,a.kiv, a.appointment_time,a.checkin_latt, a.checkin_long, a.appointment_status, l.warranty_id, nw.linked_lead , a.checkin 
      AS checkin_time, l.id AS lead_id, l.label_s, l.label_m, a.checkin_img,  l.*,  ns.id AS sales_id, l.ads_id, l.channel_id, l.customer_signature, ns.total, ns.payment_status, ns.sales_status, ns.status as whole_status, ns.gen_quotation, ns.custom_quotation,
      s2.id AS warranty_sales_id, ns.sub_total, nw.*,
       ns.discount_applied, ns.discount_image,  ns.scaff_height,  ns.scaff_fee,  ns.skylift_height,  ns.skylift_fee, ns.transportation_fee, ns.quotation_request, ns.warranty, 
       ns.working_duration, npo.name AS promo_name, npo.percentage AS promo_percent, npo.id AS promo_id,
    
      (     SELECT JSON_AGG(json_build_object('sap_id',sap_id,'name', np.name, 'area', nsl.area, 'remark', nsl.remark, 'services', nsl.services, 'sqft', nsl.sqft, 'size', nsl.size, 'rate', nsl.rate,
      'other_area', nsl.other_area, 'sub_total', nsl.sub_total, 'total', nsl.total, 'discount', nsl.discount, 'addon_id' , nsl.addon_id, 'total_after', nsl.total_after,  'warranty', nsl.package_warranty, 'discounts', 
    (SELECT JSON_AGG(JSON_BUILD_OBJECT('dis_id', c.dis_id, 'dis_name' ,c.dis_name, 'dis_remark', c.dis_remark, 'dis_percentage', 
      c.dis_percentage, 'need_photo', c.need_photo, 'photo', c.photo, 'sales_package_id', 
      c.sales_package_id, 'dis_type', c.dis_type) ORDER BY c.dis_type DESC, c.dis_id) 
    FROM nano_sales_package_discount c  WHERE c.sales_package_id = nsl.sap_id AND c.status = true) )ORDER BY sap_id ASC)
      FROM nano_sales_package nsl LEFT JOIN nano_packages np ON nsl.package_id = np.id  WHERE nsl.sales_id = ns.id)  AS sales_packages,
       
       (SELECT JSON_AGG(json_build_object('sap_id',sap_id,'name', np.name, 'area', nsl.area, 'remark', nsl.remark, 'services', nsl.services, 'sqft', nsl.sqft, 'size', nsl.size, 'rate', nsl.rate,
       'other_area', nsl.other_area, 'sub_total', nsl.sub_total, 'total', nsl.total, 'discount', nsl.discount))
       FROM nano_sales_package nsl LEFT JOIN nano_packages np ON nsl.package_id = np.id  WHERE nsl.sales_id = s2.id )  AS sales_packages_ori,
    
       (  SELECT JSON_AGG(json_build_object('sap_id',sap_id,'name', np.name, 'area', nsl.area, 'remark', nsl.remark, 'services', nsl.services, 'sqft', nsl.sqft, 'size', nsl.size, 'rate', nsl.rate,
       'other_area', nsl.other_area, 'sub_total', nsl.sub_total, 'total', nsl.total, 'discount', nsl.discount, 'pack_image', pack_image, 'pack_video', pack_video))
       FROM nano_sales_package nsl LEFT JOIN nano_packages np ON nsl.package_id = np.id 
       WHERE nsl.sales_id = s2.id 
       AND nsl.sap_id IN (select (value ->> 'sap_id')::INT as sap_id from nano_warranty, json_array_elements(faulty_area) as value where id = nw.id)
      ) as sales_package_selected,
    
       (SELECT COUNT(id) AS payment FROM nano_payment_log WHERE (sc_approval IS NULL OR ac_approval IS NULL) AND sales_id = ns.id) AS payment_null,
       (SELECT COUNT(id) AS payment1 FROM nano_payment_log WHERE (sc_approval like 'Rejected' OR ac_approval like 'Rejected') AND sales_id = ns.id) AS payment_rejected,
       
       (SELECT JSON_AGG(json_build_object('check_id', nc.no, 'check_lat', nc.check_lat, 'check_long', nc.check_long, 'check_time', nc.check_time, 'check_address', nc.check_address,
        'check_remark', nc.check_remark, 'check_status', nc.check_status)) as check_detail FROM nano_check nc WHERE nc.appointment_id = $1 AND nc.status = true),
    
        (SELECT JSON_AGG(JSON_BUILD_OBJECT('sales_order_form', orderform, 'sof_breakdown', orderform_breakdown, 'created_date' , created_date, 'isvoid', isvoid) ORDER BY created_date DESC) FROM nano_sales_order WHERE appointment_id = $1) as salesorderform_list,
    
        (SELECT JSON_AGG(JSON_BUILD_OBJECT('from_date', nsch.schedule_date)) FROM nano_schedule nsch WHERE nsch.sales_id = ns.id) as installation_date
       
        FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_warranty nw ON l.warranty_id = nw.id LEFT JOIN nano_sales s2 ON nw.linked_lead = s2.lead_id 
        LEFT JOIN nano_sales ns ON a.id = ns.appointment_id LEFT JOIN nano_promo npo ON ns.promo_code = npo.id WHERE a.id = $1
    
     `, [req.body.id]).then((result) => {

        return res.status(200).send({ data: result.rows[0], success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }
    else {
      pool.query(`SELECT a.id AS appointment_id,a.kiv, a.appointment_time,a.checkin_latt, a.checkin_long, a.appointment_status, l.warranty_id, nw.linked_lead , a.checkin 
      AS checkin_time, l.id AS lead_id, l.label_s, l.label_m, a.checkin_img,  l.*,  ns.id AS sales_id, l.ads_id, l.channel_id, l.customer_signature, ns.total, ns.payment_status, ns.sales_status, ns.status as whole_status, ns.gen_quotation, ns.custom_quotation,
      s2.id AS warranty_sales_id, ns.sub_total, nw.*,
       ns.discount_applied, ns.discount_image,  ns.scaff_height,  ns.scaff_fee,  ns.skylift_height,  ns.skylift_fee, ns.transportation_fee, ns.quotation_request, ns.warranty, 
       ns.working_duration, npo.name AS promo_name, npo.percentage AS promo_percent, npo.id AS promo_id,
    
      (     SELECT JSON_AGG(json_build_object('sap_id',sap_id,'name', np.name, 'area', nsl.area, 'remark', nsl.remark, 'services', nsl.services, 'sqft', nsl.sqft, 'size', nsl.size, 'rate', nsl.rate,
      'other_area', nsl.other_area, 'sub_total', nsl.sub_total, 'total', nsl.total, 'discount', nsl.discount, 'addon_id' , nsl.addon_id, 'total_after', nsl.total_after,  'warranty', nsl.package_warranty, 'discounts', 
    (SELECT JSON_AGG(JSON_BUILD_OBJECT('dis_id', c.dis_id, 'dis_name' ,c.dis_name, 'dis_remark', c.dis_remark, 'dis_percentage', 
      c.dis_percentage, 'need_photo', c.need_photo, 'photo', c.photo, 'sales_package_id', 
      c.sales_package_id, 'dis_type', c.dis_type) ORDER BY c.dis_type DESC, c.dis_id) 
    FROM nano_sales_package_discount c  WHERE c.sales_package_id = nsl.sap_id AND c.status = true) )ORDER BY sap_id ASC)
      FROM nano_sales_package nsl LEFT JOIN nano_packages np ON nsl.package_id = np.id  WHERE nsl.sales_id = ns.id)  AS sales_packages,
       
       (SELECT JSON_AGG(json_build_object('sap_id',sap_id,'name', np.name, 'area', nsl.area, 'remark', nsl.remark, 'services', nsl.services, 'sqft', nsl.sqft, 'size', nsl.size, 'rate', nsl.rate,
       'other_area', nsl.other_area, 'sub_total', nsl.sub_total, 'total', nsl.total, 'discount', nsl.discount))
       FROM nano_sales_package nsl LEFT JOIN nano_packages np ON nsl.package_id = np.id  WHERE nsl.sales_id = s2.id )  AS sales_packages_ori,
    
       (  SELECT JSON_AGG(json_build_object('sap_id',sap_id,'name', np.name, 'area', nsl.area, 'remark', nsl.remark, 'services', nsl.services, 'sqft', nsl.sqft, 'size', nsl.size, 'rate', nsl.rate,
       'other_area', nsl.other_area, 'sub_total', nsl.sub_total, 'total', nsl.total, 'discount', nsl.discount, 'pack_image', pack_image, 'pack_video', pack_video))
       FROM nano_sales_package nsl LEFT JOIN nano_packages np ON nsl.package_id = np.id 
       WHERE nsl.sales_id = s2.id 
       AND nsl.sap_id IN (select (value ->> 'sap_id')::INT as sap_id from nano_warranty, json_array_elements(faulty_area) as value where id = nw.id)
      ) as sales_package_selected,
    
       (SELECT COUNT(id) AS payment FROM nano_payment_log WHERE (sc_approval IS NULL OR ac_approval IS NULL) AND sales_id = ns.id) AS payment_null,
       (SELECT COUNT(id) AS payment1 FROM nano_payment_log WHERE (sc_approval like 'Rejected' OR ac_approval like 'Rejected') AND sales_id = ns.id) AS payment_rejected,
       
       (SELECT JSON_AGG(json_build_object('check_id', nc.no, 'check_lat', nc.check_lat, 'check_long', nc.check_long, 'check_time', nc.check_time, 'check_address', nc.check_address,
        'check_remark', nc.check_remark, 'check_status', nc.check_status)) as check_detail FROM nano_check nc WHERE nc.appointment_id = $1 AND nc.status = true),
    
        (SELECT JSON_AGG(JSON_BUILD_OBJECT('sales_order_form', orderform, 'sof_breakdown', orderform_breakdown, 'created_date' , created_date, 'isvoid', isvoid) ORDER BY created_date DESC) FROM nano_sales_order WHERE appointment_id = $1) as salesorderform_list,
    
        (SELECT JSON_AGG(JSON_BUILD_OBJECT('from_date', nsp.from_date)) FROM nano_sales_package nsp WHERE nsp.sales_id = ns.id) as installation_date
       
        FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_warranty nw ON l.warranty_id = nw.id LEFT JOIN nano_sales s2 ON nw.linked_lead = s2.lead_id 
        LEFT JOIN nano_sales ns ON a.id = ns.appointment_id LEFT JOIN nano_promo npo ON ns.promo_code = npo.id WHERE a.id = $1
    
     `, [req.body.id]).then((result) => {

        return res.status(200).send({ data: result.rows[0], success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }



  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })




})

app.post('/getAppointmentDetails', (req, res) => {
  console.log('getAppointmentDetails')
  pool.query(`SELECT a.id AS appointment_id, a.bypass, a.kiv, a.appointment_time,a.checkin_latt, a.checkin_long, a.appointment_status, l.warranty_id, nw.linked_lead , a.checkin 
      AS checkin_time, l.id AS lead_id, l.label_s, l.label_m, nl.name as label_s_name, nl2.name as label_m_name, a.checkin_img,  l.*,  ns.id AS sales_id, l.ads_id, l.channel_id, l.customer_signature, ns.total, ns.payment_status, ns.sales_status, ns.status as whole_status, ns.gen_quotation, ns.custom_quotation,
      s2.id AS warranty_sales_id, ns.sub_total, nw.*,
       ns.discount_applied, ns.discount_image,  ns.scaff_height,  ns.scaff_fee,  ns.skylift_height,  ns.skylift_fee, ns.transportation_fee, ns.quotation_request, ns.warranty, ns.quote_no, ns.price_breakdown,
       ns.working_duration, npo.name AS promo_name, npo.percentage AS promo_percent, npo.id AS promo_id,

       (
        SELECT json_build_object(
            'sp_approval_status', sp_approval_status, 
            'sp_leader_approve', sp_leader_approve, 
            'sp_leader_name', sp_leader_name, 
            'sp_paul_approve', sp_paul_approve
        )
        FROM nano_payment_log 
        WHERE sales_id = ns.id 
        AND sp_approval_status = true 
        ORDER BY payment_date DESC 
        LIMIT 1
    ) AS latest_payment_status,
    
      (     SELECT JSON_AGG(json_build_object('sap_id',sap_id,'name', np.name, 'area', nsl.area, 'remark', nsl.remark, 'services', nsl.services, 'sqft', nsl.sqft, 'size', nsl.size, 'rate', nsl.rate,
      'other_area', nsl.other_area, 'sub_total', nsl.sub_total, 'total', nsl.total, 'discount', nsl.discount, 'addon_id' , nsl.addon_id, 'total_after', nsl.total_after,  'warranty', nsl.package_warranty,
      'package_details', nsl.package_details, 'maintain_exist', nsl.maintain_exist, 'maintain_confirm', nsl.maintain_confirm, 'maintain_date', nsl.maintain_date, 'discounts',
    (SELECT JSON_AGG(JSON_BUILD_OBJECT('dis_id', c.dis_id, 'dis_name' ,c.dis_name, 'dis_remark', c.dis_remark, 'dis_percentage', 
      c.dis_percentage, 'need_photo', c.need_photo, 'photo', c.photo, 'sales_package_id', 
      c.sales_package_id, 'dis_type', c.dis_type) ORDER BY c.dis_type DESC, c.dis_id) 
    FROM nano_sales_package_discount c  WHERE c.sales_package_id = nsl.sap_id AND c.status = true) )ORDER BY sap_id ASC)
      FROM nano_sales_package nsl LEFT JOIN nano_packages np ON nsl.package_id = np.id  WHERE nsl.sales_id = ns.id)  AS sales_packages,
       
       (SELECT JSON_AGG(json_build_object('sap_id',sap_id,'name', np.name, 'area', nsl.area, 'remark', nsl.remark, 'services', nsl.services, 'sqft', nsl.sqft, 'size', nsl.size, 'rate', nsl.rate,
       'other_area', nsl.other_area, 'sub_total', nsl.sub_total, 'total', nsl.total, 'discount', nsl.discount))
       FROM nano_sales_package nsl LEFT JOIN nano_packages np ON nsl.package_id = np.id  WHERE nsl.sales_id = s2.id )  AS sales_packages_ori,
    
       (  SELECT JSON_AGG(json_build_object('sap_id',sap_id,'name', np.name, 'area', nsl.area, 'remark', nsl.remark, 'services', nsl.services, 'sqft', nsl.sqft, 'size', nsl.size, 'rate', nsl.rate,
       'other_area', nsl.other_area, 'sub_total', nsl.sub_total, 'total', nsl.total, 'discount', nsl.discount, 'pack_image', pack_image, 'pack_video', pack_video))
       FROM nano_sales_package nsl LEFT JOIN nano_packages np ON nsl.package_id = np.id 
       WHERE nsl.sales_id = s2.id 
       AND nsl.sap_id IN (select (value ->> 'sap_id')::INT as sap_id from nano_warranty, json_array_elements(faulty_area) as value where id = nw.id)
      ) as sales_package_selected,
    
       (SELECT COUNT(id) AS payment FROM nano_payment_log WHERE (sc_approval IS NULL OR ac_approval IS NULL) AND sales_id = ns.id) AS payment_null,
       (SELECT COUNT(id) AS payment1 FROM nano_payment_log WHERE (sc_approval like 'Rejected' OR ac_approval like 'Rejected') AND sales_id = ns.id) AS payment_rejected,
       
       (SELECT JSON_AGG(json_build_object('check_id', nc.no, 'check_lat', nc.check_lat, 'check_long', nc.check_long, 'check_time', nc.check_time, 'check_address', nc.check_address,
        'check_remark', nc.check_remark, 'check_status', nc.check_status) order by nc.no asc) as check_detail FROM nano_check nc WHERE nc.appointment_id = $1 AND nc.status = true),
    
        (SELECT JSON_AGG(JSON_BUILD_OBJECT('id', id, 'sales_order_form', orderform, 'sof_breakdown', orderform_breakdown, 'created_date' , created_date, 'isvoid', isvoid) ORDER BY created_date DESC) FROM nano_sales_order WHERE appointment_id = $1) as salesorderform_list,

        (SELECT JSON_AGG(JSON_BUILD_OBJECT('from_date', nsch.schedule_date)) FROM nano_schedule nsch WHERE nsch.sales_id = ns.id AND nsch.status = true) as installation_date,
        ( SELECT JSON_AGG(user_name) FROM nano_user WHERE uid IN ( SELECT value::text FROM JSONB_ARRAY_ELEMENTS_TEXT(a.assigned_to4::JSONB))) AS user_name
    
        FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_warranty nw ON l.warranty_id = nw.id LEFT JOIN nano_sales s2 ON nw.linked_lead = s2.lead_id 
        LEFT JOIN nano_sales ns ON a.id = ns.appointment_id LEFT JOIN nano_promo npo ON ns.promo_code = npo.id
        LEFT JOIN nano_label nl ON nl.id = l.label_s LEFT JOIN nano_label nl2 ON nl2.id = l.label_m WHERE a.id = $1
    
     `, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })








})

app.post('/updateLeadLabelSalesExec', (req, res) => {
  console.log('updateLeadLabelSalesExec')
  pool.query(`UPDATE nano_leads SET label_m = $1, label_s = $2, label_photo = $4, label_video = $5, label_remark = $6 WHERE id = $3`,
    [req.body.label_m, req.body.label_s, req.body.lead_id, req.body.label_photo, req.body.label_video, req.body.remark]).then((result) => {
      req.body.activity_time = new Date().getTime()


      pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
        [req.body.uid]).then((result) => {

          let by = result.rows[0]['user_name']
          pool.query(`INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, 
          activity_type) VALUES ($1, $2 ,$3, $4, $5)`,
            [req.body.lead_id, req.body.activity_time, req.body.uid, 'Lead Label Updated By ' + by + '\n -' + req.body.remark, 'Lead']).then((result) => {

              return res.status(200).send({ success: true })

            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updateLeadLabelSalesExec2', (req, res) => {
  console.log('updateLeadLabelSalesExec2')
  pool.query(`UPDATE nano_leads SET label_m = $1, label_s = $2, label_remark = $4 WHERE id = $3`,
    [req.body.label_m, req.body.label_s, req.body.lead_id, req.body.remark]).then((result) => {
      req.body.activity_time = new Date().getTime()


      pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
        [req.body.uid]).then((result) => {

          let by = result.rows[0]['user_name']
          pool.query(`INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, 
          activity_type) VALUES ($1, $2 ,$3, $4, $5)`,
            [req.body.lead_id, req.body.activity_time, req.body.uid, 'Lead Label Updated By ' + by + '\n -' + req.body.remark, 'Lead']).then((result) => {

              return res.status(200).send({ success: true })

            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})
//get details for the label page in lead
app.post('/getLabelForLead', (req, res) => {
  console.log('getLabelForLead')
  pool.query(`SELECT label_m, label_s, label_photo, label_video, label_remark FROM nano_leads WHERE id = $1`,
    [req.body.lead_id]).then((result) => {

      return res.status(200).send({ data: result.rows[0], success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/getAppointmentList', (req, res) => {
  console.log('getAppointmentList')
  pool.query(`SELECT a.id AS appointment_id,a.kiv,a.appointment_time, a.checkin AS checkin_time, a.checkin_img, a.appointment_status, 
  l.*, nls.payment_status, nls.sales_status,
   (SELECT JSON_AGG(JSON_BUILD_OBJECT('assigned_to4', b.user_name, 'colour', b.colour)) FROM nano_appointment jna LEFT JOIN nano_user b 
  ON b.uid = ANY(SELECT json_array_elements_text(jna.assigned_to4))
    WHERE jna.id = a.id) as assigned_to_list, 
    nu2.user_name AS sales_coordinator,
    (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('check_lat', nc.check_lat, 'check_long', nc.check_long, 'check_time', 
                                         nc.check_time, 'check_img', nc.check_img, 
                                        'check_address', nc.check_address, 'check_remark', nc.checK_remark,
                                         'check-status', nc.check_status, 
                                         'event_time', nc.event_time, 'complete_status', nc.complete_status, 'while_check_status', while_check_status)) 
     FROM nano_check nc WHERE a.id = nc.appointment_id AND nc.status = true) as check_details
      FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id
      LEFT JOIN nano_user nu4 ON (a.assigned_to3 = nu4.uid and a.assigned_to3 is not null) 
      LEFT JOIN nano_sales nls ON a.id = nls.appointment_id
      LEFT JOIN nano_user nu2 ON l.sales_coordinator = nu2.uid WHERE a.appointment_time >= $1 AND a.appointment_time <= $2`, [req.body.firstDay, req.body.lastDay]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getEventList', (req, res) => {
  console.log('getEventList')

  pool.query(`SELECT nc.*, a.id AS appointment_id,a.kiv,a.appointment_time, a.checkin AS checkin_time, a.checkin_img, a.lead_id as lead_id, l.*, nls.payment_status, nls.sales_status,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('assigned_to4', b.user_name, 'colour', b.colour)) FROM nano_appointment jna LEFT JOIN nano_user b 
ON b.uid = ANY(SELECT json_array_elements_text(jna.assigned_to4))
WHERE jna.id = a.id) as assigned_to_list, nu2.user_name AS sales_coordinator
    FROM nano_check nc LEFT JOIN nano_appointment a  ON nc.appointment_id = a.id  LEFT JOIN nano_leads l ON a.lead_id = l.id
    LEFT JOIN nano_sales nls ON a.id = nls.appointment_id
    LEFT JOIN nano_user nu2 ON l.sales_coordinator = nu2.uid WHERE (nc.check_time >= $1 AND nc.check_time <= $2) AND nc.check_status = 'hold' AND nc.status = true`, [req.body.firstDay, req.body.lastDay]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})



app.post('/getAppointmentDetailsForExec2', (req, res) => {
  console.log('getAppointmentDetailsForExec2')
  pool.query(`SELECT a.id AS appointment_id,a.kiv,a.appointment_time,a.remark,a.checkin_latt, a.checkin_long, a.checkin AS checkin_time, a.checkin_img, a.appointment_status, 
  l.*,nu.user_name AS sc_name, nls.status as whole_status, nls.sales_status, nls.payment_status,
  row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number,
  row_number() over (partition by l.address ORDER BY l.created_date ASC) as address_row_number
  FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_sales nls ON a.id = nls.appointment_id 
  LEFT JOIN nano_user nu ON l.sales_coordinator = nu.uid
  WHERE EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1) AND l.status = true ORDER BY appointment_time ASC
`, [req.body.uid]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.post('/getAppointmentDetailsForExec', (req, res) => {
  console.log('getAppointmentDetailsForExec')
  pool.query(`SELECT a.appointment_time, nls.status as whole_status, nls.sales_status, nls.payment_status, l.verified, l.warranty_id,
  row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number
  FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_sales nls ON a.id = nls.appointment_id 
  WHERE EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1) AND l.status = true ORDER BY appointment_time ASC
`, [req.body.uid]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getAppointmentDetailsForExec3', (req, res) => {
  console.log('getAppointmentDetailsForExec3')
  month = req.body.month
  year = req.body.year
  // console.log(year)
  // console.log(month)
  let d1 = new Date(year, month, 1, 0, 0, 0).getTime()
  let d2 = new Date(year, (month + 1), 0, 23, 59, 59).getTime()
  // console.log(d1, d2)

  pool.query(`SELECT a.appointment_time, nls.status as whole_status, nls.sales_status, nls.payment_status, l.verified, l.warranty_id,
  row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number
  FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_sales nls ON a.id = nls.appointment_id 
  WHERE EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1) AND l.status = true AND a.appointment_time >= $2 AND a.appointment_time <= $3
  ORDER BY appointment_time ASC
`, [req.body.uid, d1, d2]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getAppointmentDetailsForExec3Tab2', (req, res) => {
  console.log('getAppointmentDetailsForExec3Tab2')
  month = req.body.month
  year = req.body.year
  console.log(year)
  console.log(month)
  let d1 = new Date(year, month, 1, 0, 0, 0).getTime()
  let d2 = new Date(year, (month + 1), 0, 23, 59, 59).getTime()
  console.log(d1, d2)

  pool.query(`SELECT a.appointment_time, nls.status as whole_status, nls.sales_status, nls.payment_status, l.verified, l.warranty_id,
  row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number
  FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_sales nls ON a.id = nls.appointment_id 
  WHERE EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1) AND l.status = true AND a.appointment_time >= $2 AND a.appointment_time <= $3 AND (nls.sales_status = 'Deposit' OR nls.sales_status = 'Full Payment')
  ORDER BY appointment_time ASC
`, [req.body.uid, d1, d2]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getAppointmentDetailsForExec3Tab4', (req, res) => {
  console.log('getAppointmentDetailsForExec3Tab4')
  month = req.body.month
  year = req.body.year
  // console.log(year)
  // console.log(month)
  let d1 = new Date(year, month, 1, 0, 0, 0).getTime()
  let d2 = new Date(year, (month + 1), 0, 23, 59, 59).getTime()
  // console.log(d1, d2)

  pool.query(`WITH selectdata as (SELECT a.appointment_time, 
    CASE WHEN a.checkin IS NOT NULL AND NOT EXISTS(SELECT * FROM nano_check nc WHERE nc.appointment_id = a.id) THEN true
    WHEN (SELECT check_status FROM nano_check nc WHERE nc.appointment_id = a.id ORDER BY check_time DESC LIMIT 1) = 'in' THEN true
    ELSE false
            END AS haventcheckin,
            nls.status as whole_status, nls.sales_status, nls.payment_status, l.verified, l.warranty_id,
  row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number
  FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_sales nls ON a.id = nls.appointment_id 
  WHERE EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1) AND l.status = true AND a.appointment_time >= $2 AND a.appointment_time <= $3)
  SELECT * FROM selectdata WHERE haventcheckin = false ORDER BY appointment_time ASC
`, [req.body.uid, d1, d2]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getexistsdate', (req, res) => {
  console.log('getexistsdate')
  month = req.body.month
  year = req.body.year

  let daynumber = new Date(year, month + 1, 0, 0, 0, 0).getDate()


  let temp = []

  for (let i = 1; i <= daynumber; i++) {
    let d1 = new Date(year, month, (i), 0, 0, 0).getTime()
    let d2 = new Date(year, (month), (i), 23, 59, 59).getTime()


    pool.query(`WITH selectindate as (SELECT a.id, l.verified, l.warranty_id,
      row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number
      FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id
      WHERE (EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1) AND l.status = true)
      AND a.appointment_time >= $2 AND a.appointment_time <= $3
      )
      
      SELECT CASE WHEN  COUNT(id) > 0 THEN true
      ELSE false
      END AS existornot
      FROM selectindate WHERE (verified = true OR warranty_id IS NOT NULL OR phone_row_number = 1)
`, [req.body.uid, d1, d2]).then((result) => {

      temp.push(
        {
          date: i,
          state: result.rows[0]['existornot']
        })
      if (i == daynumber) {
        return res.status(200).send({ data: temp, success: true })
      }

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  }

})



app.post('/getAppointmentForExecByDate', (req, res) => {
  console.log('getAppointmentForExecByDate')

  pool.query(`SELECT a.id AS appointment_id, a.assigned_to4, a.kiv,a.appointment_time,a.remark,a.checkin_latt, a.checkin_long, a.checkin AS checkin_time, a.checkin_img, a.appointment_status, nls.status as whole_status, nls.payment_status, nls.sales_status, l.*, nu.user_name AS sc_name,
    row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number,
    row_number() over (partition by l.address ORDER BY l.created_date ASC) as address_row_number,
    (SELECT CASE
      WHEN COUNT(*) > 0 THEN true
      ELSE false
      END FROM nano_sales_order nso WHERE nso.sales_id = nls.id) AS has_sales_order_form
    FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_sales nls ON nls.appointment_id = a.id LEFT JOIN nano_user nu ON l.sales_coordinator = nu.uid
    WHERE  EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1)  AND a.appointment_time >= $2 AND a.appointment_time < $3 AND l.status = true ORDER BY appointment_time ASC`, [req.body.execId, req.body.startDate, req.body.endDate]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getAppointmentForExecByDatev2forlist', (req, res) => {
  console.log('getAppointmentForExecByDatev2forlist')

  pool.query(`SELECT a.id AS appointment_id, a.assigned_to4, a.kiv,a.appointment_time,a.remark, a.appointment_status, l.saleexec_note, nls.status as whole_status, 
  nls.payment_status, nls.sales_status, l.customer_name, l.customer_phone, l.address, l.services, l.issues, l.sc_photo, l.verified, l.warranty_id, l.sc_video, l.sc_document, nu.user_name AS sc_name,
      row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number,
      (SELECT CASE
        WHEN COUNT(*) > 0 THEN true
        ELSE false
        END FROM nano_sales_order nso WHERE nso.sales_id = nls.id) AS has_sales_order_form
      FROM nano_appointment a RIGHT JOIN nano_leads l ON a.lead_id = l.id 
      LEFT JOIN nano_sales nls ON nls.appointment_id = a.id LEFT JOIN nano_user nu ON l.sales_coordinator = nu.uid
      WHERE  EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1) 
      AND a.appointment_time >= $2 AND a.appointment_time < $3 AND l.status = true 
      ORDER BY appointment_time ASC
      `, [req.body.execId, req.body.startDate, req.body.endDate]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.post('/getAppointmentForExecByDatev2forlistTab4', (req, res) => {
  console.log('getAppointmentForExecByDatev2forlistTab4')

  pool.query(`WITH selectdata AS (SELECT a.id AS appointment_id,
  CASE WHEN a.checkin IS NOT NULL AND NOT EXISTS(SELECT * FROM nano_check nc WHERE nc.appointment_id = a.id) THEN true
  WHEN (SELECT check_status FROM nano_check nc WHERE nc.appointment_id = a.id ORDER BY check_time DESC LIMIT 1) = 'in' THEN true
  WHEN (SELECT check_status FROM nano_check nc WHERE nc.appointment_id = a.id ORDER BY check_time DESC LIMIT 1) = 'hold' THEN false
  ELSE false
  END AS haventcheckin, a.assigned_to4, a.kiv,a.appointment_time,a.remark, a.appointment_status, nls.status as whole_status, 
  nls.payment_status, nls.sales_status, l.customer_name, l.customer_phone, l.address, l.services, l.issues, l.sc_photo, l.verified, l.warranty_id, l.sc_video, l.sc_document, nu.user_name AS sc_name,
      row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number,
      (SELECT CASE
        WHEN COUNT(*) > 0 THEN true
        ELSE false
        END FROM nano_sales_order nso WHERE nso.sales_id = nls.id) AS has_sales_order_form
      FROM nano_appointment a RIGHT JOIN nano_leads l ON a.lead_id = l.id 
      LEFT JOIN nano_sales nls ON nls.appointment_id = a.id LEFT JOIN nano_user nu ON l.sales_coordinator = nu.uid
      WHERE  EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1) 
      AND a.appointment_time >= $2 AND a.appointment_time < $3 AND l.status = true)
      SELECT * FROM selectdata WHERE haventcheckin = false
      ORDER BY appointment_time ASC
      `, [req.body.execId, req.body.startDate, req.body.endDate]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.post('/getAppointmentForReminderBySchedule', (req, res) => {
  console.log('getAppointmentForReminderBySchedule')

  pool.query(`WITH selectdata as (SELECT a.id AS appointment_id, 
    (SELECT JSON_AGG(JSON_BUILD_OBJECT('date', schedule_date)) FROM nano_schedule nsc WHERE nsc.sales_id = ns.id) as schedule_date,
  a.assigned_to4, a.kiv,a.appointment_time,a.remark,a.checkin_latt, a.checkin_long, a.checkin AS checkin_time, a.checkin_img, a.appointment_status, nls.status as whole_status,
    nls.payment_status, nls.sales_status, l.*, nu.user_name AS sc_name,
  row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number,
  row_number() over (partition by l.address ORDER BY l.created_date ASC) as address_row_number
  FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_sales nls ON nls.appointment_id = a.id LEFT JOIN nano_user nu ON l.sales_coordinator = nu.uid 
  LEFT JOIN nano_sales ns ON ns.lead_id = a.lead_id
  WHERE  EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1))

SELECT * FROM selectdata WHERE EXISTS (SELECT * FROM JSON_ARRAY_ELEMENTS(schedule_date) as test
WHERE (test->>'date')::bigint >= $2 AND (test->>'date')::bigint <= $3)
ORDER BY appointment_time ASC`, [req.body.execId, req.body.startDate, req.body.endDate]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


//* ami
app.post('/getAppointmentForReminder', (req, res) => {
  console.log('getAppointmentForReminder')

  pool.query(`WITH selectdata as (SELECT a.id AS appointment_id, 
    (SELECT JSON_AGG(JSON_BUILD_OBJECT('date', from_date)) FROM nano_sales_package nsp WHERE nsp.sales_id = ns.id AND from_date IS NOT NULL) as install_date,
  a.assigned_to4, a.kiv,a.appointment_time,a.remark,a.checkin_latt, a.checkin_long, a.checkin AS checkin_time, a.checkin_img, a.appointment_status, 
    nls.payment_status, nls.sales_status, l.*, nu.user_name AS sc_name,
  row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number,
  row_number() over (partition by l.address ORDER BY l.created_date ASC) as address_row_number
  FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_sales nls ON nls.appointment_id = a.id LEFT JOIN nano_user nu ON l.sales_coordinator = nu.uid 
  LEFT JOIN nano_sales ns ON ns.lead_id = a.lead_id
  WHERE EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1) AND ns.subcon_state = 'Accepted')

SELECT * FROM selectdata WHERE EXISTS (SELECT * FROM JSON_ARRAY_ELEMENTS(install_date) as test
WHERE (test->>'date')::bigint >= $2 AND (test->>'date')::bigint <= $3)
ORDER BY appointment_time ASC`, [req.body.execId, req.body.startDate, req.body.endDate]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.post('/getAppointmentForReminder2', (req, res) => {
  console.log('getAppointmentForReminder2')

  pool.query(`  WITH selectsapid AS (SELECT sales_id, from_date2 FROM nano_sales_package WHERE 
  EXISTS(SELECT 1 FROM jsonb_array_elements_text(from_date2::jsonb) AS time 
  WHERE (time::bigint >= $2::bigint AND  time::bigint <= $3::bigint)))
  SELECT a.id AS appointment_id, nsp2.from_date2,
  a.assigned_to4, a.kiv,a.appointment_time,a.remark,a.checkin_latt, a.checkin_long, a.checkin AS checkin_time, a.checkin_img, 
  a.appointment_status, nls.payment_status, nls.sales_status, l.*, nu.user_name AS sc_name,
  row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number,
  row_number() over (partition by l.address ORDER BY l.created_date ASC) as address_row_number
  FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_sales nls ON nls.appointment_id = a.id LEFT JOIN nano_user nu ON l.sales_coordinator = nu.uid 
  LEFT JOIN nano_sales ns ON ns.lead_id = a.lead_id RIGHT JOIN selectsapid nsp2 ON nsp2.sales_id = ns.id
  WHERE EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1) AND ns.subcon_state = 'Accepted' 
ORDER BY a.appointment_time ASC`, [req.body.execId, req.body.startDate, req.body.endDate]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getSalesPackage', (req, res) => {
  console.log('getSalesPackage')

  pool.query(`SELECT *, nsl.sub_total AS subtotal FROM nano_sales_package nsl WHERE sap_id = $1 `, [req.body.sap_id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getSalesPackagev2', (req, res) => {
  console.log('getSalesPackagev2')

  pool.query(`SELECT nsl.*, 
  nsl.sub_total AS subtotal, 
  nsl.pu_status,
  nl.label_photo, 
  nl.label_video, 
  (SELECT jsonb_agg(check_img::jsonb)
   FROM nano_check 
   WHERE appointment_id = na.id AND check_status = 'in') AS check_in_photo,
  nsc.complaint_remark,
  nsc.complaint_image,
  nsc.complaint_video
FROM nano_sales_package nsl
LEFT JOIN nano_sales ns ON ns.id = nsl.sales_id 
LEFT JOIN nano_leads nl ON ns.lead_id = nl.id 
LEFT JOIN nano_appointment na ON nl.id = na.lead_id 
LEFT JOIN LATERAL (
    SELECT nsc.complaint_remark, nsc.complaint_image, nsc.complaint_video
    FROM nano_sub_complaint nsc
    WHERE nsc.sales_id = ns.id
      AND nsc.complaint_id::jsonb @> JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('sap_id', nsl.sap_id))
    ORDER BY nsc.id DESC LIMIT 1
) nsc ON true
WHERE nsl.sap_id = $1;
`, [req.body.sap_id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.post('/getWarrantySalesPackage', (req, res) => {
  console.log('getWarrantySalesPackage')

  pool.query(`SELECT * FROM nano_sales_package WHERE linked_sp = $1 `, [req.body.sap_id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getSalesPackageDetails', (req, res) => {
  console.log('getSalesPackageDetails')

  pool.query(`SELECT *, nsl.area as area2, nsl.sqft as sqft2 FROM nano_sales_package nsl LEFT JOIN nano_packages ns ON nsl.package_id = ns.id WHERE sales_id = $1 ORDER BY nsl.sap_id `, [req.body.sales_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getMainAndAddOnPackages', (req, res) => {
  console.log('getMainAndAddOnPackages')

  pool.query(`SELECT *, nsl.area as area2, nsl.sqft as sqft2 FROM nano_sales_package nsl LEFT JOIN nano_packages ns ON nsl.package_id = ns.id WHERE nsl.sap_id = $1 OR nsl.addon_id = $1 ORDER BY nsl.sap_id ASC`, [req.body.sap_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getMainAndAddOnPackagesJoinDiscount', (req, res) => {
  console.log('getMainAndAddOnPackagesJoinDiscount')

  pool.query(`SELECT *, nsl.area as area2, nsl.sqft as sqft2,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('dis_id', c.dis_id, 'dis_name' ,c.dis_name, 'dis_remark', c.dis_remark, 'dis_percentage', 
     c.dis_percentage, 'need_photo', c.need_photo, 'photo', c.photo, 'sales_package_id', 
     c.sales_package_id, 'dis_type', c.dis_type) ORDER BY c.dis_type DESC, c.dis_id) 
   FROM nano_sales_package_discount c  WHERE c.sales_package_id = nsl.sap_id AND c.status = true) as dis_items
   FROM nano_sales_package nsl LEFT JOIN nano_packages ns ON nsl.package_id = ns.id WHERE nsl.sap_id = $1 OR nsl.addon_id = $1 
   ORDER BY nsl.sap_id ASC`, [req.body.sap_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.post('/getAllMainAndAddOnPackagesJoinDiscount', (req, res) => {
  console.log('getAllMainAndAddOnPackagesJoinDiscount')

  pool.query(`   SELECT *, nsl.area as area2, nsl.sqft as sqft2,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('dis_id', c.dis_id, 'dis_name' ,c.dis_name, 'dis_remark', c.dis_remark, 'dis_percentage', 
     c.dis_percentage, 'need_photo', c.need_photo, 'photo', c.photo, 'sales_package_id', 
     c.sales_package_id, 'dis_type', c.dis_type) ORDER BY c.dis_type DESC, c.dis_id) 
   FROM nano_sales_package_discount c  WHERE c.sales_package_id = nsl.sap_id AND c.status = true) as dis_items
   FROM nano_sales_package nsl LEFT JOIN nano_packages ns ON nsl.package_id = ns.id WHERE nsl.sales_id = $1
   ORDER BY nsl.sap_id ASC`, [req.body.sales_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.post('/getAddOnPackages', (req, res) => {
  console.log('getAddOnPackages')

  pool.query(`SELECT * FROM nano_sales_package nsl LEFT JOIN nano_packages ns ON nsl.package_id = ns.id WHERE sales_id = $1 AND nsl.addon_id = $2`, [req.body.sales_id, req.body.sap_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getMainPackages', (req, res) => {
  console.log('getMainPackages')

  pool.query(`SELECT * FROM nano_sales_package nsl LEFT JOIN nano_packages ns ON nsl.package_id = ns.id WHERE sales_id = $1 AND nsl.addon_id IS NULL`, [req.body.sales_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/updateSalesPackage', (req, res) => {
  console.log('updateSalesPackage')
  // not this UpdateTask
  // console.log(req.body);
  pool.query(`UPDATE nano_sales_package SET (width, height, pack_image, pack_video, remark,
      package_id, area, sub_total, total, discount, services, sqft, size, rate, other_area, discount_roundoff, total_after) = 
     ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $18) WHERE sap_id = $17 RETURNING sales_id`,
    [req.body.width, req.body.height, req.body.image,
    req.body.video, req.body.remark, req.body.package_id, req.body.area
      , req.body.sub_total, req.body.total,
    req.body.discount, req.body.service,
    req.body.sqft, req.body.size, req.body.rate, req.body.other_area, req.body.discount_roundoff, req.body.sap_id, req.body.total_after]).then((result) => {
      let sales_id = result.rows[0]['sales_id']

      pool.query(`UPDATE nano_sales SET sub_total = $1 WHERE id = $2`,
        [req.body.total_total, sales_id
        ]).then((result) => {

          return res.status(200).send({ success: true })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })

})

app.post('/updateSalesPackagev2', (req, res) => {
  console.log('updateSalesPackagev2')
  // not this UpdateTask
  // console.log(req.body);
  let type = req.body.servicetype
  let now = new Date().getTime()
  pool.query(`UPDATE nano_sales_package SET (width, height, pack_image, pack_video, remark,
      package_id, area, sub_total, total, discount, services, sqft, size, rate, other_area, discount_roundoff, total_after, package_warranty, pu_status, package_details, maintain_exist) = 
     ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $18, $19, $20, $21, $22) WHERE sap_id = $17 RETURNING sales_id`,
    [req.body.width, req.body.height, req.body.image, req.body.video, req.body.remark, req.body.package_id, req.body.area,
    req.body.sub_total, req.body.total, req.body.discount, req.body.service, req.body.sqft, req.body.size, req.body.rate,
    req.body.other_area, req.body.discount_roundoff, req.body.sap_id, req.body.total_after, req.body.package_warranty, req.body.pu_status,
    req.body.package_details, req.body.maintain_exist]).then((result) => {
      let sales_id = result.rows[0]['sales_id']

      pool.query(`UPDATE nano_sales SET sub_total = $1 WHERE id = $2`,
        [req.body.total_total, sales_id
        ]).then((result) => {

          pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
            [req.body.uid])
            .then((result) => {

              let by = result['rows'][0]['user_name']

              pool.query(`
            INSERT INTO nano_activity_log (lead_id, appointment_id, activity_time, activity_by, remark, activity_type) 
            VALUES ($1, $2, $3, $4, $5, $6)`,
                [req.body.leadid, req.body.aid, now, req.body.uid, type == 'addon' ? ('Add on Service updated by ' + by) : ('Service updated by ' + by), 'Service'])
                .then((result) => {
                  return res.status(200).send({ success: true })

                }).catch((error) => {
                  console.log(error)
                  return res.status(800).send({ success: false })
                })
            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })

})
// INSERT INTO nano_sales_package (sales_id, width, height, pack_image, pack_video, remark,
//   package_id, place, task, sub_total, total, discount, sqft_others, service, area, sqft, size, rate)
// VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
//  [req.body.sales_id, req.body.width, req.body.height, req.body.image,
//  req.body.video, req.body.remark, req.body.package_id, req.body.place
//  ,req.body.task, req.body.sub_total, req.body.total,
//  req.body.discount, req.body.sqft_others, req.body.service,
//  req.body.area,  req.body.sqft, req.body.size, req.body.rate



app.post('/deleteSalesPackage', (req, res) => {
  console.log('deleteSalesPackage')

  let type = req.body.servicetype
  let now = new Date().getTime()

  pool.query(`DELETE FROM nano_sales_package WHERE sap_id = $1 OR addon_id = $1 `,
    [req.body.sap_id]).then((result) => {

      pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
        [req.body.uid])
        .then((result) => {

          let by = result['rows'][0]['user_name']

          pool.query(`
        INSERT INTO nano_activity_log (lead_id, appointment_id, activity_time, activity_by, remark, activity_type) 
        VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.body.leadid, req.body.aid, now, req.body.uid, type == 'addon' ? ('One add on Service deleted by ' + by) : ('One service updated by ' + by), 'Service'])
            .then((result) => {
              return res.status(200).send({ success: true })

            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })
        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })

})

app.post('/getAllSalesPackage', (req, res) => {
  console.log('getAllSalesPackage')

  pool.query(`SELECT * FROM nano_sales_package nsl LEFT JOIN nano_packages ns ON nsl.package_id = ns.id `, [req.body.sales_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/addNewSalesPackage', (req, res) => {
  console.log('addNewSalesPackage');

  req.body.from_date = new Date().getTime()
  //Changed task to JSON, insert [] as default when creating new package
  req.body.task = JSON.stringify([])
  req.body.sub_completed = JSON.stringify([])
  pool.query(`INSERT INTO nano_sales_package (sales_id, width, height, pack_image, pack_video, remark,
     package_id, area, task, sub_total, total, discount, services, sqft, size, rate, other_area, sub_completed, discount_roundoff, addon_id)
   VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
    [req.body.sales_id, req.body.width, req.body.height, req.body.image,
    req.body.video, req.body.remark, req.body.package_id, req.body.area
      , req.body.task, req.body.sub_total, req.body.total,
      null, req.body.service, req.body.sqft, req.body.size,
    req.body.rate, req.body.other_area, req.body.sub_completed, null, req.body.addon_id
    ]).then((result) => {

      pool.query(`UPDATE nano_sales SET sub_total = $1 WHERE id = $2`,
        [req.body.total_total, req.body.sales_id
        ]).then((result) => {

          return res.status(200).send({ success: true })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/addNewSalesPackagev3', (req, res) => {
  console.log('addNewSalesPackagev3');


  let type = req.body.servicetype
  req.body.from_date = new Date().getTime()
  //Changed task to JSON, insert [] as default when creating new package
  req.body.task = JSON.stringify([])
  req.body.sub_completed = JSON.stringify([])
  pool.query(`INSERT INTO nano_sales_package (sales_id, width, height, pack_image, pack_video, remark,
     package_id, area, task, sub_total, total, discount, services, sqft, size, rate, other_area, sub_completed, discount_roundoff, addon_id, package_warranty, pu_status, package_details, maintain_exist)
   VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
    [req.body.sales_id, req.body.width, req.body.height, req.body.image, req.body.video, req.body.remark, req.body.package_id, req.body.area
      , req.body.task, req.body.sub_total, req.body.total, null, req.body.service, req.body.sqft, req.body.size,
    req.body.rate, req.body.other_area, req.body.sub_completed, null, req.body.addon_id, req.body.package_warranty, req.body.pu_status,
    req.body.package_details, req.body.maintain_exist
    ]).then((result) => {

      pool.query(`UPDATE nano_sales SET sub_total = $1 WHERE id = $2`,
        [req.body.total_total, req.body.sales_id
        ]).then((result) => {

          pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
            [req.body.uid])
            .then((result) => {

              let by = result['rows'][0]['user_name']

              pool.query(`
              INSERT INTO nano_activity_log (lead_id, appointment_id, activity_time, activity_by, remark, activity_type) 
              VALUES ($1, $2, $3, $4, $5, $6)`,
                [req.body.leadid, req.body.aid, req.body.from_date, req.body.uid, type == 'addon' ? ('New Add on Service added by ' + by) : ('New Service added by ' + by), 'Service'])
                .then((result) => {
                  return res.status(200).send({ success: true })

                }).catch((error) => {
                  console.log(error)
                  return res.status(800).send({ success: false })
                })
            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/addNewSalesPackageBulk', async (req, res) => {
  try {
    console.log('addNewSalesPackageBulk');
    let type = req.body.servicetype;
    let quantity = Number(req.body.quantity) || 1;
    let now = new Date().getTime();

    // Prepare shared fields
    req.body.from_date = now;
    req.body.task = JSON.stringify([]);
    req.body.sub_completed = JSON.stringify([]);
    let insertedIds = [];

    for (let i = 0; i < quantity; i++) {
      let result = await pool.query(`
        INSERT INTO nano_sales_package (
          sales_id, width, height, pack_image, pack_video, remark, package_id, area, task, sub_total, total, discount,
          services, sqft, size, rate, other_area, sub_completed, discount_roundoff, addon_id, package_warranty, pu_status,
          package_details, maintain_exist
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        ) RETURNING sap_id
      `, [
        req.body.sales_id, req.body.width, req.body.height, req.body.image, req.body.video, req.body.remark,
        req.body.package_id, req.body.area, req.body.task, req.body.sub_total, req.body.total, null,
        req.body.service, req.body.sqft, req.body.size, req.body.rate, req.body.other_area, req.body.sub_completed,
        null, req.body.addon_id, req.body.package_warranty, req.body.pu_status, req.body.package_details,
        req.body.maintain_exist
      ]);
      insertedIds.push(result.rows[0].sap_id);
    }

    // Update total just ONCE after all inserts
    await pool.query(`UPDATE nano_sales SET sub_total = $1 WHERE id = $2`, [
      req.body.total_total, req.body.sales_id
    ]);

    // Log activity just ONCE
    let userRes = await pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`, [req.body.uid]);
    let by = userRes.rows[0].user_name;
    const isBulk = quantity > 1;
    const actionRemark =
      isBulk
        ? (
            type === 'addon'
              ? `Bulk Add on Service (${quantity}) added by ${by}`
              : `Bulk Service (${quantity}) added by ${by}`
          )
        : (
            type === 'addon'
              ? `New Add on Service added by ${by}`
              : `New Service added by ${by}`
          );
    
    await pool.query(`
      INSERT INTO nano_activity_log (lead_id, appointment_id, activity_time, activity_by, remark, activity_type) 
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      req.body.leadid, req.body.aid, now, req.body.uid,
      actionRemark,
      'Service'
    ]);

    return res.status(200).send({ success: true, inserted: insertedIds.length, ids: insertedIds });

  } catch (error) {
    console.log(error);
    return res.status(800).send({ success: false, error });
  }
});


app.post('/addNewSalesPackage2', (req, res) => {
  console.log('addNewSalesPackage2');

  req.body.from_date = new Date().getTime()
  //Changed task to JSON, insert [] as default when creating new package
  req.body.task = JSON.stringify([])
  req.body.sub_completed = JSON.stringify([])
  pool.query(`INSERT INTO nano_sales_package (sales_id, width, height, pack_image, pack_video, remark,
     package_id, area, task, sub_total, total, discount, services, sqft, size, rate, other_area,linked_sp)
   VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [req.body.sales_id, req.body.width, req.body.height, req.body.image,
    req.body.video, req.body.remark, req.body.package_id, req.body.area
      , req.body.task, req.body.sub_total, req.body.total,
      null, req.body.service, req.body.sqft, req.body.size,
    req.body.rate, req.body.other_area, req.body.linked_sp
    ]).then((result) => {

      pool.query(`UPDATE nano_sales SET sub_total = $1 WHERE id = $2`,
        [req.body.total_total, req.body.sales_id
        ]).then((result) => {

          return res.status(200).send({ success: true })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


app.post('/checkInAppointment', (req, res) => {
  console.log('checkInAppointment');
  req.body.subcon_choice = JSON.stringify([])
  pool.query(`
            UPDATE nano_leads SET (label_m, label_s) = (55,46) WHERE id = $1`,
    [req.body.lead_id]).then((result) => {
      pool.query(`UPDATE nano_appointment SET (checkin_latt, checkin_long , checkin, checkin_img, checkin_address) = ($1, $2, $3, $4::json, $5) where id = $6`,
        [req.body.latt, req.body.long, req.body.time, req.body.image, req.body.checkin_address, req.body.aid]).then((result) => {
          req.body.created_date = new Date().getTime()
          req.body.appointment_id = req.body.aid
          req.body.discount_image = JSON.stringify([])
          req.body.discount_applied = JSON.stringify([])
          req.body.custom_quotation = JSON.stringify([])
          req.body.gen_quotation = JSON.stringify([])
          pool.query(`
              INSERT INTO nano_sales
                (created_date, appointment_id, sales_status,subcon_choice, discount_image, discount_applied, 
                  promo_code, lead_id,custom_quotation, gen_quotation, finance_check, status)
               VALUES ($1,$2,$3, $4, $5, $6, $7, (SELECT nl.id FROM nano_leads nl LEFT JOIN nano_appointment na 
                ON nl.id = na.lead_id WHERE na.id = $2), $8, $9, null, false)`,
            [req.body.created_date, req.body.appointment_id, req.body.sales_status, req.body.subcon_choice,
            req.body.discount_image, req.body.discount_applied, req.body.promo_code, req.body.custom_quotation, req.body.gen_quotation]).then((result) => {
              pool.query(`
                      SELECT user_name FROM nano_user WHERE uid = $1
                    `, [req.body.uid]).then((result) => {
                let by = result.rows[0]['user_name']
                pool.query(`
                      INSERT INTO nano_activity_log (lead_id, appointment_id, activity_time, activity_by, remark, activity_type) 
                      VALUES((SELECT nl.id FROM nano_leads nl LEFT JOIN nano_appointment na ON nl.id = na.lead_id WHERE na.id = $1), 
                      $1, $2, $3, $4, $5)
                    `,
                  [req.body.appointment_id, req.body.created_date, req.body.uid, 'Appointment Checked In By ' + by, 'Appointment'])
                  .then((result) => {
                    return res.status(200).send({ success: true })

                  }).catch((error) => {
                    console.log(error)
                    return res.status(800).send({ success: false })
                  })

              }).catch((error) => {
                console.log(error)
                return res.status(800).send({ success: false })
              })


            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })



        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })


})

app.post('/checkInAppointment2', (req, res) => {
  console.log('checkInAppointment2');

  req.body.subcon_choice = JSON.stringify([])
  pool.query(`
            UPDATE nano_leads SET (label_m, label_s) = (55,46) WHERE id = $1`,
    [req.body.lead_id]).then((result) => {
      pool.query(`INSERT INTO nano_check (check_lat, check_long , check_time, check_img, check_address , appointment_id , check_status, while_check_status) VALUES ($1, $2, $3, $4::json, $5, $6, $7, $8)`,
        [req.body.latt, req.body.long, req.body.time, req.body.image, req.body.checkin_address, req.body.aid, req.body.check_status, req.body.while_check_status]).then((result) => {

          pool.query(`SELECT id FROM nano_sales WHERE lead_id = $1`
            , [req.body.lead_id]).then((checksales) => {
              if (checksales.rows.length < 1) {
                req.body.created_date = new Date().getTime()
                req.body.appointment_id = req.body.aid
                req.body.discount_image = JSON.stringify([])
                req.body.discount_applied = JSON.stringify([])
                req.body.custom_quotation = JSON.stringify([])
                req.body.gen_quotation = JSON.stringify([])
                pool.query(`
                  INSERT INTO nano_sales
                    (created_date, appointment_id, sales_status,subcon_choice, discount_image, discount_applied, 
                      promo_code, lead_id,custom_quotation, gen_quotation, finance_check, status)
                   VALUES ($1,$2,$3, $4, $5, $6, $7, (SELECT nl.id FROM nano_leads nl LEFT JOIN nano_appointment na 
                    ON nl.id = na.lead_id WHERE na.id = $2), $8, $9, null, false)`,
                  [req.body.created_date, req.body.appointment_id, req.body.sales_status, req.body.subcon_choice,
                  req.body.discount_image, req.body.discount_applied, req.body.promo_code, req.body.custom_quotation, req.body.gen_quotation]).then((result) => {

                    pool.query(`
                          SELECT user_name FROM nano_user WHERE uid = $1
                        `, [req.body.uid]).then((result) => {
                      let by = result.rows[0]['user_name']
                      pool.query(`
                          INSERT INTO nano_activity_log (lead_id, appointment_id, activity_time, activity_by, remark, activity_type) 
                          VALUES((SELECT nl.id FROM nano_leads nl LEFT JOIN nano_appointment na ON nl.id = na.lead_id WHERE na.id = $1), 
                          $1, $2, $3, $4, $5)
                        `,
                        [req.body.appointment_id, req.body.created_date, req.body.uid, 'Appointment Checked In By ' + by, 'Appointment'])
                        .then((result) => {
                          return res.status(200).send({ success: true })

                        }).catch((error) => {
                          console.log(error)
                          return res.status(800).send({ success: false })
                        })

                    }).catch((error) => {
                      console.log(error)
                      return res.status(800).send({ success: false })
                    })


                  }).catch((error) => {
                    console.log(error)
                    return res.status(800).send({ success: false })
                  })
              }
              else {
                pool.query(`
                    SELECT user_name FROM nano_user WHERE uid = $1
                  `, [req.body.uid]).then((result) => {
                  let by = result.rows[0]['user_name']
                  pool.query(`
                    INSERT INTO nano_activity_log (lead_id, appointment_id, activity_time, activity_by, remark, activity_type) 
                    VALUES((SELECT nl.id FROM nano_leads nl LEFT JOIN nano_appointment na ON nl.id = na.lead_id WHERE na.id = $1), 
                   $1, $2, $3, $4, $5)
                  `,
                    [req.body.appointment_id, req.body.created_date, req.body.uid, 'Appointment Checked In By ' + by, 'Appointment'])
                    .then((result) => {
                      return res.status(200).send({ success: true })

                    }).catch((error) => {
                      console.log(error)
                      return res.status(800).send({ success: false })
                    })

                }).catch((error) => {
                  console.log(error)
                  return res.status(800).send({ success: false })
                })
              }


            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })




        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })


})

app.post('/checkInAppointmentAgain', (req, res) => {
  console.log('checkInAppointmentAgain');
  req.body.subcon_choice = JSON.stringify([])
  pool.query(`
            UPDATE nano_leads SET (label_m, label_s) = (55,46) WHERE id = $1`,
    [req.body.lead_id]).then((result) => {
      pool.query(`INSERT INTO nano_check (check_lat, check_long , check_time, check_img, check_address , appointment_id , check_status, while_check_status) VALUES ($1, $2, $3, $4::json, $5, $6, $7, $8)`,
        [req.body.latt, req.body.long, req.body.time, req.body.image, req.body.checkin_address, req.body.aid, req.body.check_status, req.body.while_check_status]).then((result) => {
          req.body.created_date = new Date().getTime()
          pool.query(`
          SELECT user_name FROM nano_user WHERE uid = $1
        `, [req.body.uid]).then((result) => {
            let by = result.rows[0]['user_name']
            pool.query(`
          INSERT INTO nano_activity_log (lead_id, appointment_id, activity_time, activity_by, remark, activity_type) 
          VALUES($6, $1, $2, $3, $4, $5)
        `,
              [req.body.aid, req.body.created_date, req.body.uid, 'Appointment Checked In Again By ' + by, 'Appointment', req.body.lead_id])
              .then((result) => {
                return res.status(200).send({ success: true })

              }).catch((error) => {
                console.log(error)
                return res.status(800).send({ success: false })
              })

          }).catch((error) => {
            console.log(error)
            return res.status(800).send({ success: false })
          })


        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })


})


app.post('/insertCheckOut', (req, res) => {
  console.log('insertCheckOut');
  let now = new Date().getTime()

  // pool.query(`UPDATE nano_leads SET label_m = $1, label_s = $2, label_photo = $4, label_video = $5, label_remark = $6 WHERE id = $3`,
  // [req.body.label_m, req.body.label_s, req.body.lead_id, req.body.label_photo, req.body.label_video, req.body.remark]).then((result) => {

  pool.query(`WITH insertnanocheck as (INSERT INTO nano_check (check_lat, check_long , check_time, check_img, check_address , appointment_id , check_remark, check_status, event_time) VALUES ($1, $2, $3, $4::json, $5, $6, $7, $8, $12)RETURNING *),
  updatelabel as (UPDATE nano_leads SET label_m = $9, label_s = $10 WHERE id = $11)
  SELECT * FROM insertnanocheck`,
    [req.body.latt, req.body.long, now, req.body.image, req.body.checkin_address, req.body.aid, req.body.remark, req.body.check_status, req.body.label_m, req.body.label_s, req.body.lead_id, req.body.event_time]).then((result) => {
      return res.status(200).send({ success: true })
    })
    .catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


app.post('/insertCheckOut2', (req, res) => {
  console.log('insertCheckOut2');
  let now = new Date().getTime()

  pool.query(`WITH insertnanocheck as (INSERT INTO nano_check 
    (appointment_id, check_time, check_remark, check_status) 
    VALUES ($1, $2, $6, $3)RETURNING *),
  insertactivitylog as (INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, 
    activity_type) VALUES ($4, $2 ,$5, $6, $7))
  SELECT * FROM insertnanocheck`,
    [req.body.aid, now, req.body.check_status, req.body.lead_id, req.body.uid, 'Appointment Checked Out By ' + req.body.by, 'Appointment']).then((result) => {
      return res.status(200).send({ success: true })
    })
    .catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/createEvent', (req, res) => {
  console.log('createEvent');
  let now = new Date().getTime()

  // pool.query(`UPDATE nano_leads SET label_m = $1, label_s = $2, label_photo = $4, label_video = $5, label_remark = $6 WHERE id = $3`,
  // [req.body.label_m, req.body.label_s, req.body.lead_id, req.body.label_photo, req.body.label_video, req.body.remark]).then((result) => {

  pool.query(`INSERT INTO nano_check (appointment_id, check_remark, check_status, event_time, check_time) VALUES ($1, $2, $3, $4, $5)`,
    [req.body.aid, req.body.remark, req.body.check_status, req.body.event_time, now]).then((result) => {
      return res.status(200).send({ success: true })
    })
    .catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/getEvent', (req, res) => {
  console.log('getEvent');

  pool.query(`SELECT * FROM nano_check where appointment_id = $1 AND status = true`,
    [req.body.aid]).then((result) => {
      return res.status(200).send({ data: result.rows, success: true })
    })
    .catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


app.post('/removeEvent', (req, res) => {
  console.log('removeEvent');

  pool.query(`UPDATE nano_check SET status = false WHERE no = $1`,
    [req.body.no]).then((result) => {
      return res.status(200).send({ success: true })
    })
    .catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


//payment_date: null
//payment_status: "Incomplete"
//sales_id: 2
//sales_status: "quotation"
//total: 20380

// sales_id: this.appointment.sales_id,
//sales_status: status,
//payment_status: 'In Progress',
//payment_date: this.payment_date,
//total: this.total,
//promo_code : this.promocode,
//discount_applied: JSON.stringify(this.discountselected2.map(a => a['id'])) || [],
//discount_image: JSON.stringify(tempimage) || []
app.post('/updateSalesQuotation', (req, res) => {
  console.log('updateSalesQuotation');

  pool.query(`UPDATE nano_sales SET (total, sales_status, sub_total,quote_no)
   = ($1, $3, $4, $5) WHERE id = $2`,
    [req.body.total, req.body.sales_id, req.body.sales_status, req.body.sub_total, req.body.quote_no]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/updatePromoCodeInSales', (req, res) => {
  console.log('updatePromoCodeInSales');

  pool.query(`UPDATE nano_sales SET promo_code
   = $1 WHERE id = $2`,
    [req.body.promo_code, req.body.sales_id]).then((result) => {

      pool.query(`DELETE FROM nano_sales_discount WHERE sales_id = $1`,
        [req.body.sales_id]).then((result) => {

          return res.status(200).send({ success: true })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ error: error.message, success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/uploadGenQuotation', (req, res) => {
  console.log('uploadGenQuotation');
  let now = new Date().getTime()

  pool.query(`WITH updategenquotation as (UPDATE nano_sales SET gen_quotation = $1 WHERE id = $2 RETURNING id),
  updateacticitylog as (INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, 
    activity_type) VALUES ($3, $4 ,$5, $6, $7))
    SELECT * FROM updategenquotation`,
    [req.body.quotation, req.body.sales_id, req.body.lead_id, now, req.body.uid, 'Quotation Generated By ' + req.body.by + ' (SE)\n', 'Quotation']).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/getQuotation', (req, res) => {
  console.log('getQuotation');

  pool.query(`SELECT custom_quotation FROM nano_sales WHERE id = $1`,
    [req.body.sales_id]).then((result) => {

      if (result.rows[0]['custom_quotation'] == null || result.rows[0]['custom_quotation'] == undefined) {
        pool.query(`SELECT gen_quotation FROM nano_sales WHERE id = $1`,
          [req.body.sales_id]).then((result1) => {

            return res.status(200).send({ data: result1.rows[0], success: true })

          }).catch((error) => {
            console.log(error)
            return res.status(800).send({ error: error.message, success: false })
          })

      } else {
        return res.status(200).send({ data: result.rows[0], success: true })
      }


    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/getAllQuotationForSE', (req, res) => {
  console.log('getAllQuotationForSE');

  pool.query(`SELECT gen_quotation, custom_quotation FROM nano_sales WHERE id = $1`,
    [req.body.sales_id]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/getReceiptInApp', (req, res) => {
  console.log('getReceiptInApp');

  pool.query(`SELECT * FROM nano_payment_log WHERE sales_id = $1 ORDER BY id DESC`,
    [req.body.sales_id]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.get('/getSPleader', (req, res) => {
  console.log('getSPleader');

  pool.query(`SELECT nl.*, ns.*, npl.*,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('sales_order_form', orderform, 'sof_breakdown', orderform_breakdown, 'created_date' , created_date, 'isvoid', isvoid) ORDER BY created_date DESC) FROM nano_sales_order WHERE sales_id = ns.id) as salesorderform_list,
  ( SELECT JSON_AGG(user_name) FROM nano_user WHERE uid IN ( SELECT value::text FROM JSONB_ARRAY_ELEMENTS_TEXT(nat.assigned_to4::JSONB))) AS user_name
  FROM nano_payment_log npl
  JOIN nano_sales ns ON ns.id = npl.sales_id 
  JOIN nano_leads nl ON nl.id = ns.lead_id
  JOIN nano_appointment nat ON nl.id = nat.lead_id
  WHERE sp_approval_status = true ORDER BY npl.id DESC`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})

app.get('/getSPleaderCount', (req, res) => {
  console.log('getSPleaderCount');

  pool.query(`SELECT * FROM nano_payment_log WHERE (sp_approval_status = true AND sp_leader_approve = 'Pending') ORDER BY id DESC`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})

app.post('/removeReceiptInApp', (req, res) => {
  console.log('removeReceiptInApp');

  pool.query(`DELETE FROM nano_payment_log WHERE id = $1`,
    [req.body.id]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/updateSalesPayment', (req, res) => {
  console.log('updateSalesPayment');

  pool.query(`UPDATE nano_sales SET (total, discount_applied, discount_image, sub_total)
   = ($1, $2::json, $3::json, $5) WHERE id = $4`,
    [req.body.total, req.body.discount_applied,
    req.body.discount_image, req.body.sales_id, req.body.sub_total]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/updateSalesRemark', (req, res) => {
  console.log('updateSalesRemark');

  pool.query(`UPDATE nano_sales SET (sales_status, payment_date) = ($1,$2) WHERE id = $3`,
    [req.body.sales_status, req.body.payment_date, req.body.sales_id]).then((result) => {
      req.body.receipt = JSON.stringify([])
      pool.query(`INSERT INTO nano_payment_log(type, payment_image, total, sales_id
        ,payment_date, created_by, gateway,remark, receipt) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [req.body.type, req.body.payment_image, req.body.total, req.body.sales_id,
        req.body.payment_date, req.body.created_by, req.body.gateway, req.body.remark, req.body.receipt]).then((result) => {

          return res.status(200).send({ success: true })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ error: error.message, success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })
})

app.post('/updateSalesRemark2', (req, res) => {
  console.log('updateSalesRemark2');

  pool.query(`UPDATE nano_sales SET (sales_status, payment_date, total) = ($1,$2, $4) WHERE id = $3`,
    [req.body.sales_status, req.body.payment_date, req.body.sales_id, req.body.payment_left]).then((result) => {
      req.body.receipt = JSON.stringify([])
      pool.query(`INSERT INTO nano_payment_log(type, payment_image, total, sales_id
        ,payment_date, created_by, gateway,remark, receipt, cust_sign, receipt_img, receipt_pdf,
        ac_approval, sc_approval) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [req.body.type, req.body.payment_image, req.body.total, req.body.sales_id,
        req.body.payment_date, req.body.created_by, req.body.gateway, req.body.remark, req.body.receipt, req.body.cust_sign,
        req.body.receipt_img, req.body.receipt_pdf, req.body.ac_approval, req.body.sc_approval]).then((result) => {

          req.body.created_date = new Date().getTime()
          pool.query(`
          SELECT user_name FROM nano_user WHERE uid = $1
        `, [req.body.created_by]).then((result) => {
            let by = result.rows[0]['user_name']
            pool.query(`
          INSERT INTO nano_activity_log (lead_id, appointment_id, sales_id, activity_time, activity_by, remark, activity_type) 
          VALUES($1, $2, $3, $4, $5, $6, $7)
        `,
              [req.body.leadid, req.body.aid, req.body.sales_id, req.body.created_date, req.body.created_by, 'Payment RM ' + req.body.total + ' has been pay by customer, updated by ' + by, 'Payment'])
              .then((result) => {
                return res.status(200).send({ success: true })

              }).catch((error) => {
                console.log(error)
                return res.status(800).send({ success: false })
              })

          }).catch((error) => {
            console.log(error)
            return res.status(800).send({ success: false })
          })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ error: error.message, success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })
})


app.post('/updateSalesRemark3', (req, res) => {
  console.log('updateSalesRemark3');

  pool.query(`UPDATE nano_sales SET (sales_status, payment_date, total) = ($1,$2, $4) WHERE id = $3`,
    [req.body.sales_status, req.body.payment_date, req.body.sales_id, req.body.payment_left]).then((result) => {
      req.body.receipt = JSON.stringify([])
      pool.query(`INSERT INTO nano_payment_log(type, payment_image, total, sales_id
        ,payment_date, created_by, gateway,remark, receipt, cust_sign, receipt_img, receipt_pdf,
        ac_approval, sc_approval, sp_approval_status, sp_approval_log, sp_leader_approve, sp_paul_approve) 
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [req.body.type, req.body.payment_image, req.body.total, req.body.sales_id,
        req.body.payment_date, req.body.created_by, req.body.gateway, req.body.remark, req.body.receipt, req.body.cust_sign,
        req.body.receipt_img, req.body.receipt_pdf, req.body.ac_approval, req.body.sc_approval,
        req.body.sp_approval_status, req.body.sp_approval_log, req.body.sp_leader_approve, req.body.sp_paul_approve]).then((result) => {

          req.body.created_date = new Date().getTime()
          pool.query(`
          SELECT user_name FROM nano_user WHERE uid = $1
        `, [req.body.created_by]).then((result) => {
            let by = result.rows[0]['user_name']
            pool.query(`
          INSERT INTO nano_activity_log (lead_id, appointment_id, sales_id, activity_time, activity_by, remark, activity_type) 
          VALUES($1, $2, $3, $4, $5, $6, $7)
        `,
              [req.body.leadid, req.body.aid, req.body.sales_id, req.body.created_date, req.body.created_by, 'Payment RM ' + req.body.total + ' has been pay by customer, updated by ' + by, 'Payment'])
              .then((result) => {
                return res.status(200).send({ success: true })

              }).catch((error) => {
                console.log(error)
                return res.status(800).send({ success: false })
              })

          }).catch((error) => {
            console.log(error)
            return res.status(800).send({ success: false })
          })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ error: error.message, success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })
})




//SUB CON

//Sub admin

//Manage Tasks
//NEED FIXING

app.post('/getSpecificCompanyDetailUid', async (req, res) => {
  console.log('getSpecificCompanyDetailUid')

  pool.query(`SELECT * FROM sub_company WHERE uid = $1`, [req.body.uid]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

// AND is_complaint != true
app.post('/getPendingSalesForSubCon', (req, res) => {
  console.log('getPendingSalesForSubCon');

  pool.query(`
  SELECT nl.customer_name, nl.address, nl.customer_phone, nl.customer_state, nl.customer_city, 
         ns.subcon_state, ns.id AS sales_id, nl.id AS lead_id,
         (SELECT COUNT(sap_id) FROM nano_sales_package WHERE sales_id = ns.id) AS task_count,
         (SELECT array_agg(DISTINCT dates::bigint ORDER BY dates::bigint ASC)
          FROM (
            SELECT jsonb_array_elements_text(nsp.from_date2::jsonb) AS dates
            FROM nano_sales_package nsp
            WHERE nsp.sales_id = ns.id
          ) subquery) AS install_date
  FROM nano_sales ns 
  LEFT JOIN nano_leads nl ON ns.lead_id = nl.id
  WHERE pending_subcon = $1::text 
    AND subcon_state = 'Pending' 
    AND (ns.is_complaint = false OR ns.is_complaint is null)
`, [req.body.company])
    .then((result) => {
      return res.status(200).send({ data: result.rows, success: true });
    })
    .catch((error) => {
      console.log(error);
      return res.status(500).send({ error: error.message, success: false });
    });
});


app.post('/getPendingSalesForSubCon2', (req, res) => {
  console.log('getPendingSalesForSubCon2');

  pool.query(`
    SELECT COUNT(*)
    FROM nano_sales ns
    LEFT JOIN nano_leads nl ON ns.lead_id = nl.id
    WHERE pending_subcon = $1::text
      AND subcon_state = 'Pending'
      AND (ns.is_complaint = false OR ns.is_complaint is null)
  `, [req.body.company]).then((result) => {

    // Extract the total count from the result
    const totalCount = result.rows[0].count;
    return res.status(200).send({ totalCount, success: true });

  }).catch((error) => {
    console.log(error);
    return res.status(800).send({ error: error.message, success: false });
  });
});

app.post('/getAcceptedSalesForSubCon', (req, res) => {
  console.log('getAcceptedSalesForSubCon')

  pool.query(`SELECT nl.customer_name, nl.address, nl.customer_phone, nl.customer_state, nl.customer_city, ns.subcon_state, ns.id AS sales_id, nl.id AS lead_id,
  (SELECT COUNT(sap_id) FROM nano_sales_package WHERE sales_id = ns.id) AS task_count
  FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id
  WHERE pending_subcon = $1::text AND subcon_state IN ('Accepted', 'Cancelled') AND (ns.is_complaint = false OR ns.is_complaint is null)`,
    [req.body.company]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/getAcceptedSalesForSubCon2', (req, res) => {
  console.log('getAcceptedSalesForSubCon2')

  pool.query(`
  SELECT COUNT(*)
  FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id
  WHERE pending_subcon = $1::text AND subcon_state IN ('Accepted', 'Cancelled') AND (ns.is_complaint = false OR ns.is_complaint is null)`,
    [req.body.company]).then((result) => {

      const totalCount = result.rows[0].count;
      return res.status(200).send({ totalCount, success: true });

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})


app.post('/getAllSalesForSubCon', (req, res) => {
  console.log('getAllSalesForSubCon')

  pool.query(`SELECT nl.customer_name, nl.address, nl.customer_phone, nl.customer_state, nl.customer_city,ns.subcon_choice, ns.subcon_state, ns.id AS sales_id, nl.id AS lead_id, ns.accepted_subcon, ns.final_approval,
  (SELECT COUNT(sap_id) FROM nano_sales_package WHERE sales_id = ns.id) AS task_count
  FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id
  WHERE $1 IN (SELECT REPLACE(bj.value ->> 'company'::varchar(100), '"', '') FROM nano_sales ns2, JSON_ARRAY_ELEMENTS(ns2.subcon_choice) bj 
  WHERE ns2.id = ns.id) AND subcon_state = 'Accepted' OR subcon_state = 'Rejected'`,
    [req.body.company]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/getComplaintAllBySales', async (req, res) => {
  console.log('getComplaintAllBySales');

  pool.query(`SELECT * FROM nano_sub_complaint WHERE sales_id = $1 ORDER BY id ASC`, [req.body.sales_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/updateSalesStatus', (req, res) => {
  console.log('updateSalesStatus')

  pool.query(`UPDATE nano_sales SET is_complaint = $1 WHERE id = $2`,
    [req.body.is_complaint, req.body.sales_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/updateSalesBreakdown', (req, res) => {
  console.log('updateSalesBreakdown')

  pool.query(`UPDATE nano_sales SET price_breakdown = $1 WHERE id = $2`,
    [req.body.price_breakdown, req.body.sales_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})
// this.storeTeamMember = this.storeTeamMember.map((a) => {uid: a['uid'], role: 'member'})
// [{uid: 'asdasd', role: 'member'}, {uid: 'asdasd', role: 'member'}]// this is how it looks like after map
// let leader = [{uid: this.storeTeamLeader, role: 'leader'}]
// let temp = this.storeTeamMember.concat(leader)
// temp = JSON.stringify(temp)

// let passApi = JSON.stringify(this.storeTeamMember.map((a) => {uid: a['uid'], role: 'member'}).concat([{uid: this.storeTeamLeader, role: 'leader'}])) // one line work
// let rejectedAssignedWorker = JSON.stringify([])

// let stateAccepted = 'Accepted'
// let stateRejected = 'Rejected' 
//Project Manager
app.post('/updateSubSalesStatus', (req, res) => {
  console.log('updateSubSalesStatus')

  pool.query(`UPDATE nano_sales SET (subcon_state, accepted_subcon, assigned_worker, sub_team, pm_remark, task_status) = ($1,$2,$3::json, $5::json, $6, true) 
  WHERE id = $4`,
    [req.body.subcon_state, req.body.accepted_subcon, req.body.assigned_worker, req.body.sales_id, req.body.sub_team, req.body.pm_remark]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/updateSubSalesStatus2', (req, res) => {
  console.log('updateSubSalesStatus2')
  let now = new Date().getTime()
  pool.query(`
SELECT user_name FROM sub_user WHERE uid = $1
`, [req.body.uid]).then((result) => {
    let by = result.rows[0]['user_name']

    pool.query(`WITH updatessstatus AS (UPDATE nano_sales SET (subcon_state, accepted_subcon, assigned_worker, sub_team, pm_remark) = ($1,$2,$3::json, $5::json, $6) 
  WHERE id = $4 RETURNING *),
  insertactivitylog as (INSERT INTO nano_activity_log (lead_id, sales_id, activity_time, activity_by, remark, activity_type) 
    VALUES($7,  $4, $8, $9, $10, $11)),
    insertscnotification as (INSERT INTO nano_sc_notification (sn_created_date, lead_id, sn_remark, uid, to_id) 
  VALUES ($8, $7, $10, $9, (SELECT sales_coordinator FROM nano_leads WHERE id = $8)))
    SELECT * FROM updatessstatus`,
      [req.body.subcon_state, req.body.accepted_subcon, req.body.assigned_worker, req.body.sales_id, req.body.sub_team, req.body.pm_remark,
      req.body.lead_id, now, req.body.uid, req.body.log + 'by ' + by, req.body.activity_type]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ error: error.message, success: false })
      })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})


app.post('/updateSubSalesStatus3', (req, res) => {
  console.log('updateSubSalesStatus3')

  pool.query(`UPDATE nano_sales SET (subcon_state, accepted_subcon, assigned_worker, sub_team, pm_remark, task_status, assigned_worker_log) = ($1,$2,$3::json, $5::json, $6, true, $7::json) 
  WHERE id = $4`,
    [req.body.subcon_state, req.body.accepted_subcon, req.body.assigned_worker, req.body.sales_id, req.body.sub_team, req.body.pm_remark, req.body.assigned_worker_log]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/updateSubMaintenanceStatus', (req, res) => {
  console.log('updateSubMaintenanceStatus')

  pool.query(`UPDATE nano_sales SET (m_state, m_accepted_subcon, assigned_worker, sub_team, pm_remark, task_status, assigned_worker_log) = ($1,$2,$3::json, $5::json, $6, true, $7::json) 
  WHERE id = $4`,
    [req.body.m_state, req.body.m_accepted_subcon, req.body.assigned_worker, req.body.sales_id, req.body.sub_team, req.body.pm_remark, req.body.assigned_worker_log]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/getAllSalesForSubCon', (req, res) => {
  console.log('getAllSalesForSubCon')

  pool.query(`SELECT nl.customer_name, nl.address, nl.customer_phone, nl.customer_state, nl.customer_city, ns.subcon_state,
  (SELECT COUNT(sap_id) FROM nano_sales_package WHERE sales_id = ns.id) AS task_count
  FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id
  WHERE pending_subcon = $1::text AND subcon_state != 'Pending'`,
    [req.body.company]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

// Manage Team
app.post('/createTeam', (req, res) => {
  console.log('createTeam')

  pool.query(`INSERT INTO sub_team(name, colour, status, members) 
  VALUES($1, $2, true, $3::JSON) `,
    [req.body.name, req.body.colour, req.body.members]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/editTeam', (req, res) => {
  console.log('editTeam')

  pool.query(`UPDATE sub_team SET (name, colour, status) = ($1, $2, $3) WHERE team_id = $4`,
    [req.body.name, req.body.colour, req.body.status, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

// app.post('/editTeam', (req, res) => {
//   console.log('editTeam')

//   pool.query(`UPDATE sub_team (name, colour, status) = ($1, $2, $3)`,
//     [req.body.name, req.body.colour, req.body.status]).then((result) => {

//       return res.status(200).send({ success: true })

//     }).catch((error) => {
//       console.log(error)
//       return res.status(800).send({ error: message, success: false })
//     })

// })

app.get('/getTeam', (req, res) => {
  console.log('getTeam')

  pool.query(`
  SELECT DISTINCT  s.name, s.colour, s.status, s.team_id,
  (SELECT COUNT(bj3.value) FROM 
  sub_team s3, JSON_ARRAY_ELEMENTS(s3.members) bj3 WHERE s3.team_id = s.team_id) AS total,
  
  (SELECT JSONB_AGG(jsonb_build_object('user_name', user_name, 'uid', uid)) 
  FROM sub_user WHERE uid::text
  IN  (SELECT REPLACE(bj.value::varchar(100), '"', '') FROM sub_team s2, JSON_ARRAY_ELEMENTS(s2.members) bj 
  WHERE s2.team_id = s.team_id)) AS members
  FROM sub_team s`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})

app.post('/getSpecificTeam', (req, res) => {
  console.log('getSpecificTeam')

  pool.query(`SELECT s.name, s.colour, s.status,s.team_id
     FROM sub_team s WHERE team_id = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: message, success: false })
  })

})

app.post('/getSpecificTeamMember', (req, res) => {
  console.log('getSpecificTeamMember')

  pool.query(`SELECT DISTINCT 
  (SELECT JSONB_AGG(jsonb_build_object('user_name', user_name, 'uid', uid
  , 'user_phone', user_phone_no, 'user_email', user_email)) 
  FROM sub_user WHERE uid::text
  IN (SELECT REPLACE(bj.value::varchar(100), '"', '') FROM sub_team s2, JSON_ARRAY_ELEMENTS(s2.members) bj 
  WHERE s2.team_id = s.team_id)) AS members
   FROM sub_team s, JSON_ARRAY_ELEMENTS(s.members) bj2 WHERE s.team_id = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})



app.post('/addNewTeamMember', (req, res) => {
  console.log('addNewTeamMember')

  pool.query(`UPDATE sub_team set members = $2::json WHERE team_id = $1`, [req.body.id, req.body.members]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: message, success: false })
  })

})




app.get('/getSubUser', (req, res) => {
  console.log('getSubUser')

  pool.query(`SELECT * FROM sub_user`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: message, success: false })
  })

})

app.post('/removeUserFromTeam', (req, res) => {
  console.log('removeUserFromTeam')


  pool.query(`
  UPDATE sub_team SET members = members::jsonb - $1 WHERE team_id = $2`,
    [req.body.uid, req.body.id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

app.post('/getSpecificSubUserPanel', (req, res) => {
  console.log('getSpecificSubUserPanel')

  pool.query(`SELECT * FROM sub_user WHERE uid = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})

app.post('/getSpecificSubUser', (req, res) => {
  console.log('getSpecificSubUser')

  pool.query(`SELECT * FROM sub_user WHERE uid = $1 AND status IS TRUE`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})

app.post('/createSub', async (req, res) => {

  admin.auth().createUser({ email: req.body.email, password: req.body.password }).then(a => {
    req.body.uid = a.uid;
    req.body.created_at = new Date().getTime()

    //pm , SB 
    pool.query(`INSERT INTO sub_user(user_name, user_phone_no, user_email,user_state,user_address, employee_id, 
      login_id, password, active, status, created_at, profile_image, uid, user_document) 
    VALUES($1,$2,$3,$4,$5,
     'SB' || LPAD(nextval('subconuser'):: varchar, 5, '0')   
     ,$6,$7,true,true,$8,$9,$10, $11)`, [req.body.name, req.body.phone, req.body.email, req.body.state,
    req.body.address, req.body.login_id, req.body.password, req.body.created_at, req.body.profile_image, req.body.uid, req.body.user_document]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(200).send({ message: error.message, success: false })
    })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error.message })
  })

})

app.post('/editSub', async (req, res) => {
  console.log('editSub');


  admin.auth().updateUser(req.body.uid, { password: req.body.password }).then(() => {

    pool.query(`UPDATE sub_user SET (user_name, user_phone_no,user_state,user_address, status, profile_image, password, user_document, login_id) 
    = ($1,$2,$3,$4,$5,$6, $8, $9, $10) WHERE uid = $7`, [req.body.name, req.body.phone, req.body.state,
    req.body.address, req.body.status, req.body.profile_image, req.body.uid, req.body.password, req.body.user_document, req.body.login_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error.message })
  })

})


//subcon APP

app.post('/checkInSubCon', async (req, res) => {
  console.log('checkInSubCon');

  pool.query(
    `INSERT INTO sub_check_in ( sales_id, checkin_time, checkin_img, checkin_lat, checkin_long, checkin_sub, checkin_address) VALUES 
  ($1, $2, $3, $4, $5, $6, $7)`,
    [req.body.sales_id, req.body.checkin_time, req.body.checkin_image, req.body.checkin_lat,
    req.body.checkin_long, req.body.checkin_sub, req.body.checkin_address]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error.message, success: false })
    })
})

app.post('/checkInSubCon2', async (req, res) => {
  console.log('checkInSubCon2');

  let now = new Date().getTime()
  pool.query(`
  SELECT user_name FROM sub_user WHERE uid = $1
`, [req.body.uid]).then((result) => {
    let by = result.rows[0]['user_name']

    pool.query(
      `WITH checkinsubcon as (INSERT INTO sub_check_in ( sales_id, checkin_time, checkin_img, checkin_lat, checkin_long, checkin_sub, checkin_address) VALUES 
    ($1, $2, $3, $4, $5, $6, $7) RETURNING *),
    insertactivitylog as (INSERT INTO nano_activity_log (lead_id, sales_id, activity_time, activity_by, remark, activity_type) 
    VALUES($8,  $1, $9, $10, $11, $12))
    SELECT * FROM checkinsubcon `,
      [req.body.sales_id, req.body.checkin_time, req.body.checkin_image, req.body.checkin_lat,
      req.body.checkin_long, req.body.checkin_sub, req.body.checkin_address, req.body.lead_id, now, req.body.uid, 'Checked In By ' + by, 'Subcon/Installation']).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ message: error.message, success: false })
      })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error.message, success: false })
  })
})

app.post('/checkInSubCon3', async (req, res) => {
  console.log('checkInSubCon3');

  let now = new Date().getTime()
  pool.query(`
  SELECT user_name FROM sub_user WHERE uid = $1
`, [req.body.uid]).then((result) => {
    let by = result.rows[0]['user_name']

    pool.query(
      `WITH checkinsubcon as (INSERT INTO sub_check_in ( sales_id, checkin_time, checkin_img, checkin_lat, checkin_long, checkin_sub, checkin_address, check_useruid) VALUES 
    ($1, $2, $3, $4, $5, $6, $7, $10) RETURNING *),
    insertactivitylog as (INSERT INTO nano_activity_log (lead_id, sales_id, activity_time, activity_by, remark, activity_type) 
    VALUES($8,  $1, $9, $10, $11, $12))
    SELECT * FROM checkinsubcon `,
      [req.body.sales_id, req.body.checkin_time, req.body.checkin_image, req.body.checkin_lat,
      req.body.checkin_long, req.body.checkin_sub, req.body.checkin_address, req.body.lead_id, now, req.body.uid, 'Check-in Installation By ' + by, 'Subcon/Installation']).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ message: error.message, success: false })
      })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error.message, success: false })
  })
})


app.post('/checkOutSubCon', async (req, res) => {
  console.log('checkOutSubCon');

  pool.query(
    `SELECT user_name FROM sub_user WHERE uid = $1`,
    [req.body.check_out_by]).then((result) => {

      let name = result.rows[0]['user_name']

      pool.query(
        `UPDATE sub_check_in SET (check_out, check_out_by) = ($2, $3) WHERE id = $1`,
        [req.body.check_id, req.body.check_out, 'This time slot has been check out by ' + name]).then((result) => {

          return res.status(200).send({ success: true })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ message: error.message, success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error.message, success: false })
    })


})

app.post('/checkOutSubCon2', async (req, res) => {
  console.log('checkOutSubCon2');
  let now = new Date().getTime()

  pool.query(
    `SELECT user_name FROM sub_user WHERE uid = $1`,
    [req.body.check_out_by]).then((result) => {

      let name = result.rows[0]['user_name']

      pool.query(
        `WITH updatecheckout as (UPDATE sub_check_in SET (check_out, check_out_by) = ($2, $3) WHERE id = $1 RETURNING *),
        insertactivitylog as (INSERT INTO nano_activity_log (lead_id, sales_id, activity_time, activity_by, remark, activity_type) 
        VALUES($4, $5, $6, $7, $8, $9))
        SELECT * FROM updatecheckout`,
        [req.body.check_id, req.body.check_out, 'Checked Out by ' + name,
        req.body.lead_id, req.body.sales_id, now, req.body.check_out_by, 'Check Out Installation Task By ' + name, 'Subcon/Installation']).then((result) => {

          return res.status(200).send({ success: true })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ message: error.message, success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error.message, success: false })
    })


})

app.post('/checkOutSubCon3', async (req, res) => {
  console.log('checkOutSubCon3');
  let now = new Date().getTime();

  try {
    // 1. Get user name
    const userResult = await pool.query(
      `SELECT user_name FROM sub_user WHERE uid = $1`,
      [req.body.check_out_by]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).send({ message: 'User not found', success: false });
    }

    const name = userResult.rows[0]['user_name'];

    // 2. Verify the check-in belongs to the user trying to check out
    const checkInResult = await pool.query(
      `SELECT check_useruid FROM sub_check_in WHERE id = $1`,
      [req.body.check_id]
    );

    if (checkInResult.rows.length === 0) {
      return res.status(400).send({ message: 'Check-in record not found', success: false });
    }

    if (checkInResult.rows[0].check_useruid !== req.body.check_out_by) {
      return res.status(403).send({ message: 'You can only check out your own check-ins', success: false });
    }

    // 3. Update check-out
    const updateResult = await pool.query(
      `WITH updatecheckout as (
        UPDATE sub_check_in 
        SET (check_out, check_out_by) = ($2, $3) 
        WHERE id = $1 AND check_useruid = $7
        RETURNING *
       ),
       insertactivitylog as (
        INSERT INTO nano_activity_log 
        (lead_id, sales_id, activity_time, activity_by, remark, activity_type) 
        VALUES($4, $5, $6, $7, $8, $9)
       )
       SELECT * FROM updatecheckout`,
      [
        req.body.check_id,
        req.body.check_out,
        'Check-out Installation By ' + name,
        req.body.lead_id,
        req.body.sales_id,
        now,
        req.body.check_out_by,
        'Check-out Installation By ' + name,
        'Subcon/Installation'
      ]
    );

    if (updateResult.rows.length === 0) {
      return res.status(400).send({ message: 'Check-out failed - record not updated', success: false });
    }

    return res.status(200).send({ success: true });

  } catch (error) {
    console.log(error);
    return res.status(500).send({ message: error.message, success: false });
  }
});

app.post('/checkOutSubCon4', async (req, res) => {
  console.log('checkOutSubCon4');
  let now = new Date().getTime();

  try {
    // 1. Get user name
    const userResult = await pool.query(
      `SELECT user_name FROM sub_user WHERE uid = $1`,
      [req.body.check_out_by]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).send({ message: 'User not found', success: false });
    }

    const name = userResult.rows[0]['user_name'];

    // 2. Verify the check-in belongs to the user trying to check out
    const checkInResult = await pool.query(
      `SELECT check_useruid FROM sub_check_in WHERE id = $1`,
      [req.body.check_id]
    );

    if (checkInResult.rows.length === 0) {
      return res.status(400).send({ message: 'Check-in record not found', success: false });
    }

    if (checkInResult.rows[0].check_useruid !== req.body.check_out_by) {
      return res.status(403).send({ message: 'You can only check out your own check-ins', success: false });
    }

    // 3. Update check-out
    const updateResult = await pool.query(
      `WITH updatecheckout as (
        UPDATE sub_check_in 
        SET (check_out, check_out_by, check_out_img, check_out_lat, check_out_long, check_out_address) = ($2, $3, $10, $11, $12, $13) 
        WHERE id = $1 AND check_useruid = $7
        RETURNING *
       ),
       insertactivitylog as (
        INSERT INTO nano_activity_log 
        (lead_id, sales_id, activity_time, activity_by, remark, activity_type) 
        VALUES($4, $5, $6, $7, $8, $9)
       )
       SELECT * FROM updatecheckout`,
      [
        req.body.check_id,
        req.body.check_out,
        'Check-out Installation By ' + name,
        req.body.lead_id,
        req.body.sales_id,
        now,
        req.body.check_out_by,
        'Check-out Installation By ' + name,
        'Subcon/Installation',
        req.body.check_out_img,
        req.body.check_out_lat,
        req.body.check_out_long,
        req.body.check_out_address,
      ]
    );

    if (updateResult.rows.length === 0) {
      return res.status(400).send({ message: 'Check-out failed - record not updated', success: false });
    }

    return res.status(200).send({ success: true });

  } catch (error) {
    console.log(error);
    return res.status(500).send({ message: error.message, success: false });
  }
});

app.post('/getCheckinForSub', async (req, res) => {
  console.log('getCheckinForSub');

  pool.query(
    `SELECT * FROM sub_check_in WHERE sales_id = $1`,
    [req.body.sales_id]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error.message, success: false })
    })
})

app.post('/getAllTaskForSub', async (req, res) => {
  console.log('getAllTaskForSub');

  pool.query(`SELECT nl.customer_name, nl.customer_phone, nl.address, ns.id AS sales_id , ns.assigned_worker AS worker, ns.status,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('sap_id', sap_id, 'place', nsp.area, 'service', np.service, 'remark', nsp.remark,
  'task', nsp.task, 'from_date', nsp.from_date, 'from_date2', nsp.from_date2, 'sub_completed', nsp.sub_completed, 'sub_total', nsp.sub_total, 'total', nsp.total, 'discount', nsp.discount,
  'services', nsp.services, 'sqft', nsp.sqft, 'size', nsp.size, 'rate', nsp.rate, 'other_area', nsp.other_area )) 
   FROM nano_sales_package nsp LEFT JOIN nano_packages np ON nsp.package_id = np.id  WHERE sales_id = ns.id) AS sap,

   (SELECT * FROM
    (SELECT JSON_AGG(JSON_BUILD_OBJECT('schedule_date', schedule_date::bigint)) FROM
    (SELECT schedule_date FROM nano_schedule WHERE sales_id = ns.id ORDER BY schedule_date ASC) p) agg) AS schedule,

(SELECT j.value ->> 'role' FROM nano_sales s, JSON_ARRAY_ELEMENTS(assigned_worker) j 
 WHERE j.value ->> 'uid' = $1 AND s.id = ns.id) AS role
   FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id 
  WHERE $1::text IN 
  (SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj) `, [req.body.uid]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/getAllTaskScheduleForSub', async (req, res) => {
  console.log('getAllTaskScheduleForSub');

  pool.query(`SELECT nl.customer_name, nl.customer_phone, nl.address, ns.id AS sales_id , ns.assigned_worker AS worker, ns.status,
  
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('sap_id', sap_id, 'place', nsp.area, 'service', np.service, 'remark', nsp.remark,
  'task', nsp.task, 'from_date', nsp.from_date,  'from_date2', nsp.from_date2, 'sub_completed', nsp.sub_completed, 'sub_total', nsp.sub_total, 'total', nsp.total, 'discount', nsp.discount,
  'services', nsp.services, 'sqft', nsp.sqft, 'size', nsp.size, 'rate', nsp.rate, 'other_area', nsp.other_area )) 
   FROM nano_sales_package nsp LEFT JOIN nano_packages np ON nsp.package_id = np.id  WHERE sales_id = ns.id) AS sap, nsc.schedule_date,

  (SELECT j.value ->> 'role' FROM nano_sales s, JSON_ARRAY_ELEMENTS(assigned_worker) j 
  WHERE j.value ->> 'uid' = $1  AND s.id = ns.id) AS role

  FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id LEFT JOIN nano_schedule nsc ON ns.id = nsc.sales_id
  WHERE $1::text IN 
  (SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj) `, [req.body.uid]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

//new subcon api
// incomplete task
app.post('/getMonthTaskForUpcoming', async (req, res) => {
  console.log('getMonthTaskForUpcoming');

  pool.query(`WITH selectdata AS (SELECT ns.id AS sales_id , ns.assigned_worker AS worker, ns.status, nsp.from_date, 
    JSON_ARRAY_ELEMENTS_TEXT(nsp.from_date2) as from_date2
      FROM nano_sales ns LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id
      WHERE $1::text IN 
      (SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj) 
      AND ns.subcon_state::text = 'Accepted' AND (ns.status = false OR ns.status is null) OR ns.is_postpone = true) 
      SELECT * FROM selectdata WHERE from_date2::BIGINT >= $2 and from_date2::BIGINT <= $3`, [req.body.uid, req.body.startdate, req.body.enddate]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/getTaskListForUpcoming', async (req, res) => {
  console.log('getTaskListForUpcoming');

  pool.query(`
    WITH selectdata AS (
      SELECT 
        nl.customer_name, nl.customer_phone, nl.address, 
        ns.id AS sales_id, ns.assigned_worker AS worker, 
        ns.status, ns.scaff_fee, ns.skylift_fee,
        (
          SELECT JSON_AGG(JSON_BUILD_OBJECT(
            'sap_id', sap_id, 'place', nsp.area, 'service', np.service, 'remark', nsp.remark,
            'task', nsp.task, 'from_date', nsp.from_date, 'from_date2', nsp.from_date2, 'from_date3', nsp.from_date3,
            'sub_completed', nsp.sub_completed, 'sub_total', nsp.sub_total, 'total', nsp.total, 'discount', nsp.discount,
            'services', nsp.services, 'sqft', nsp.sqft, 'size', nsp.size, 'rate', nsp.rate, 'other_area', nsp.other_area
          )) FROM nano_sales_package nsp LEFT JOIN nano_packages np ON nsp.package_id = np.id WHERE nsp.sales_id = ns.id
        ) AS sap,
        JSON_ARRAY_ELEMENTS_TEXT(nsp.from_date2) AS schedule_date,
        (
          SELECT STRING_AGG(j.value ->> 'role', ',') 
          FROM nano_sales s, JSON_ARRAY_ELEMENTS(assigned_worker) j 
          WHERE j.value ->> 'uid' = $1 AND s.id = ns.id
        ) AS role,
        (
          SELECT COALESCE(JSON_AGG(schedule.*), '[]'::json)
          FROM nano_schedule AS schedule
          WHERE schedule.sales_id = ns.id AND schedule.status = true
        ) AS work_schedule
      FROM nano_sales ns
      LEFT JOIN nano_leads nl ON ns.lead_id = nl.id
      LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id
      WHERE $1::text IN (
        SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') 
        FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj
      )
      AND ns.subcon_state = 'Accepted'
      AND (ns.status = false OR ns.status IS NULL OR ns.is_postpone = true)
    )
    SELECT * FROM selectdata 
    WHERE schedule_date::BIGINT >= $2 AND schedule_date::BIGINT <= $3 
    ORDER BY schedule_date::BIGINT ASC
  `, [req.body.uid, req.body.from_date, req.body.to_date])
    .then((result) => {
      return res.status(200).send({ data: result.rows, success: true });
    })
    .catch((error) => {
      console.log(error);
      return res.status(800).send({ message: error, success: false });
    });
});


app.post('/getMonthTaskForUpcoming2', async (req, res) => {
  console.log('getMonthTaskForUpcoming2');
  pool.query(`
    WITH selectdata AS (
      SELECT ns.id AS sales_id, ns.assigned_worker AS worker, ns.status, nsp.from_date, 
        JSON_ARRAY_ELEMENTS_TEXT(nsp.from_date2) AS schedule_date
      FROM nano_sales ns
      LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id
      WHERE $1::text IN (
        SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj
      )
      AND ns.subcon_state::text = 'Accepted'
      AND (ns.status = false OR ns.status IS NULL OR ns.is_postpone = true)

      UNION ALL

      SELECT ns.id AS sales_id, ns.assigned_worker AS worker, ns.status, nsp.from_date, 
        JSON_ARRAY_ELEMENTS_TEXT(nsp.from_date4) AS schedule_date
      FROM nano_sales ns
      LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id
      WHERE $1::text IN (
        SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj
      )
      AND ns.subcon_state::text = 'Accepted'
      AND (ns.status = false OR ns.status IS NULL OR ns.is_postpone = true)
    )
    SELECT * FROM selectdata WHERE schedule_date::BIGINT >= $2 and schedule_date::BIGINT <= $3
  `, [req.body.uid, req.body.startdate, req.body.enddate]).then((result) => {
    return res.status(200).send({ data: result.rows, success: true });
  }).catch((error) => {
    console.log(error);
    return res.status(800).send({ message: error, success: false });
  });
});


app.post('/getTaskListForUpcoming2', async (req, res) => {
  console.log('getTaskListForUpcoming2');

  pool.query(`
    WITH selectdata AS (
      SELECT 
        nl.customer_name, nl.customer_phone, nl.address, 
        ns.id AS sales_id, ns.assigned_worker AS worker, 
        ns.status, ns.scaff_fee, ns.skylift_fee,
        (
          SELECT JSON_AGG(JSON_BUILD_OBJECT(
            'sap_id', sap_id, 'place', nsp.area, 'service', np.service, 'remark', nsp.remark,
            'task', nsp.task, 'from_date', nsp.from_date, 'from_date2', nsp.from_date2, 'from_date3', nsp.from_date3, 'from_date4', nsp.from_date4,
            'sub_completed', nsp.sub_completed, 'sub_total', nsp.sub_total, 'total', nsp.total, 'discount', nsp.discount,
            'services', nsp.services, 'sqft', nsp.sqft, 'size', nsp.size, 'rate', nsp.rate, 'other_area', nsp.other_area
          )) FROM nano_sales_package nsp LEFT JOIN nano_packages np ON nsp.package_id = np.id WHERE nsp.sales_id = ns.id
        ) AS sap,
        schedule_date,
        (
          SELECT STRING_AGG(j.value ->> 'role', ',') 
          FROM nano_sales s, JSON_ARRAY_ELEMENTS(assigned_worker) j 
          WHERE j.value ->> 'uid' = $1 AND s.id = ns.id
        ) AS role,
        (
          SELECT COALESCE(JSON_AGG(schedule.*), '[]'::json)
          FROM nano_schedule AS schedule
          WHERE schedule.sales_id = ns.id AND schedule.status = true
        ) AS work_schedule
      FROM nano_sales ns
      LEFT JOIN nano_leads nl ON ns.lead_id = nl.id
      LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id
      CROSS JOIN LATERAL (
        SELECT schedule_date
        FROM (
          SELECT UNNEST(
            ARRAY[
              CASE WHEN nsp.from_date2 IS NULL OR nsp.from_date2::text IN ('null', '[]') THEN '[]'::json ELSE nsp.from_date2 END,
              CASE WHEN nsp.from_date4 IS NULL OR nsp.from_date4::text IN ('null', '[]') THEN '[]'::json ELSE nsp.from_date4 END
            ]
          ) AS arr
        ) AS t1,
        JSON_ARRAY_ELEMENTS_TEXT(t1.arr) AS schedule_date
      ) AS all_dates
      WHERE $1::text IN (
        SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') 
        FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj
      )
      AND ns.subcon_state = 'Accepted'
      AND (ns.status = false OR ns.status IS NULL OR ns.is_postpone = true)
    )
    SELECT * FROM selectdata 
    WHERE schedule_date::BIGINT >= $2 AND schedule_date::BIGINT <= $3 
    ORDER BY schedule_date::BIGINT ASC
  `, [req.body.uid, req.body.from_date, req.body.to_date])
    .then((result) => {
      return res.status(200).send({ data: result.rows, success: true });
    })
    .catch((error) => {
      console.log(error);
      return res.status(800).send({ message: error, success: false });
    });
});








//complete task api
app.post('/getMonthTaskForCompleted', async (req, res) => {
  console.log('getMonthTaskForCompleted');

  pool.query(`WITH selectdata AS (SELECT ns.id AS sales_id, ns.assigned_worker AS worker, ns.status, nsp.from_date, 
    JSON_ARRAY_ELEMENTS_TEXT(nsp.from_date2) as from_date2
      FROM nano_sales ns LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id
      WHERE $1::text IN 
      (SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj) 
      AND ns.subcon_state::text = 'Accepted' AND ((ns.final_approval = true) OR (ns.status = true)) )
      SELECT * FROM selectdata WHERE from_date2::BIGINT >= $2 and from_date2::BIGINT <= $3`, [req.body.uid, req.body.startdate, req.body.enddate]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/getTaskListForCompleted', async (req, res) => {
  console.log('getTaskListForCompleted');
  // LbdDaz3w3yPFVjTEQVr6PbGP3PC3

  pool.query(`WITH selectdata AS (SELECT nl.customer_name, nl.customer_phone, nl.address, ns.id AS sales_id, ns.assigned_worker AS worker, ns.status, ns.final_approval,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('sap_id', sap_id, 'place', nsp.area, 'service', np.service, 'remark', nsp.remark,
  'task', nsp.task, 'from_date', nsp.from_date,  'from_date2', nsp.from_date2, 'sub_completed', nsp.sub_completed, 'sub_total', nsp.sub_total, 'total', nsp.total, 'discount', nsp.discount,
  'services', nsp.services, 'sqft', nsp.sqft, 'size', nsp.size, 'rate', nsp.rate, 'other_area', nsp.other_area ))
   FROM nano_sales_package nsp LEFT JOIN nano_packages np ON nsp.package_id = np.id  WHERE sales_id = ns.id ) AS sap,

   JSON_ARRAY_ELEMENTS_TEXT(nsp.from_date2) AS schedule_date,

  (SELECT j.value ->> 'role' FROM nano_sales s, JSON_ARRAY_ELEMENTS(assigned_worker) j 
  WHERE j.value ->> 'uid' = $1  AND s.id = ns.id) AS role

  FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id WHERE $1::text IN 
  (SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj)
  AND ns.subcon_state = 'Accepted' AND ((ns.final_approval = true) OR (ns.status = true)) )
  SELECT * FROM selectdata WHERE schedule_date::BIGINT >= $2 AND schedule_date::BIGINT <= $3 ORDER BY schedule_date::bigint ASC`
    , [req.body.uid, req.body.from_date, req.body.to_date]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

// task list project manager
app.post('/getCompletedTaskListPM', async (req, res) => {
  console.log('getCompletedTaskListPM')

  pool.query(`WITH selectdata AS (SELECT nl.customer_name, nl.customer_phone, nl.address, ns.id AS sales_id, ns.lead_id, ns.assigned_worker AS worker, ns.status, ns.final_approval,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('sap_id', sap_id, 'place', nsp.area, 'service', np.service, 'remark', nsp.remark,
  'task', nsp.task, 'from_date', nsp.from_date,  'from_date2', nsp.from_date2, 'sub_completed', nsp.sub_completed, 'sub_total', nsp.sub_total, 'total', nsp.total, 'discount', nsp.discount,
  'services', nsp.services, 'sqft', nsp.sqft, 'size', nsp.size, 'rate', nsp.rate, 'other_area', nsp.other_area ))
   FROM nano_sales_package nsp LEFT JOIN nano_packages np ON nsp.package_id = np.id  WHERE sales_id = ns.id ) AS sap,

   JSON_ARRAY_ELEMENTS_TEXT(nsp.from_date2) AS schedule_date

  FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id WHERE
   ns.subcon_state = 'Accepted' AND ns.status = true )
  SELECT * FROM selectdata WHERE schedule_date::BIGINT >= $1 AND schedule_date::BIGINT <= $2`
    , [req.body.from_date, req.body.to_date]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

app.post('/getCompletedTaskListPM2', async (req, res) => {
  console.log('getCompletedTaskListPM2')

  pool.query(`WITH sales_data AS 
  (SELECT 
        ns.id AS sales_id, ns.lead_id, ns.assigned_worker AS worker, ns.status, ns.final_approval, ns.is_complaint, ns.task_completed_date AS completed_date, nl.customer_name, 
        nl.customer_phone, nl.customer_state, nl.customer_city, nl.address, nl.services, nsp.from_date2 AS schedule_dates, nl.id AS lead_id,
        (
            SELECT 
                JSON_AGG(JSON_BUILD_OBJECT(
                    'sap_id', sap_id, 'place', nsp.area, 'service', np.service, 'remark', nsp.remark, 'task', nsp.task, 'from_date', nsp.from_date,  'from_date2', nsp.from_date2, 
                    'sub_completed', nsp.sub_completed, 'sub_total', nsp.sub_total, 'total', nsp.total, 'discount', nsp.discount, 'services', nsp.services, 'sqft', nsp.sqft, 
                    'size', nsp.size, 'rate', nsp.rate, 'other_area', nsp.other_area))
            FROM nano_sales_package nsp
            LEFT JOIN nano_packages np ON nsp.package_id = np.id
            WHERE nsp.sales_id = ns.id
        ) AS sap,
        (
            SELECT REGEXP_REPLACE(ssf.serviceform, '.*/(SER-NANO-[^-]+).*', '\\1')
            FROM (
                SELECT DISTINCT ON (lead_id) lead_id, serviceform
                FROM subcon_service_form
                WHERE lead_id = ns.lead_id
                ORDER BY lead_id, serviceform DESC
            ) AS ssf
        ) AS ser_num
    FROM nano_sales ns
    LEFT JOIN nano_leads nl ON ns.lead_id = nl.id
    LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id
    WHERE (ns.subcon_state = 'Accepted' OR ns.subcon_state = 'Rejected') AND ns.status IS NOT NULL AND ns.pending_subcon = $3::text
  )
    SELECT * FROM sales_data WHERE EXISTS (SELECT 1 FROM JSON_ARRAY_ELEMENTS_TEXT(schedule_dates) AS schedule_date WHERE schedule_date::BIGINT >= $1 AND schedule_date::BIGINT <= $2)
    ORDER BY completed_date DESC NULLS LAST;
`
    , [req.body.from_date, req.body.to_date, req.body.company]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

app.post('/getMaintenanceListAll', async (req, res) => {
  console.log('getMaintenanceListAll');

  try {
    const currentUserUid = req.body.uid; // Make sure to pass this from frontend

    // First get all maintenance records for the current user
    const baseQuery = `SELECT 
    ns.*, 
    nl.*, ns.id as sales_id,
    nu.user_name AS sc_name,
    (
      SELECT JSON_AGG(nsp)
      FROM nano_sales_package nsp
      WHERE nsp.sales_id = ns.id
      AND nsp.maintain_exist = true
    ) AS packages,
    (
      SELECT REGEXP_REPLACE(ssf.serviceform, '.*/(SER-NANO-[^-]+).*', '\\1')
      FROM (
        SELECT DISTINCT ON (lead_id) lead_id, serviceform
        FROM subcon_service_form
        WHERE lead_id = ns.lead_id
        ORDER BY lead_id, serviceform DESC
      ) AS ssf
    ) AS ser_num,
    (
      SELECT na.assigned_to4
      FROM nano_appointment na
      WHERE na.lead_id = ns.lead_id
      LIMIT 1
    ) AS assigned_to4,
    (
      SELECT JSON_AGG(json_build_object(
        'uid', nu.uid,
        'name', COALESCE(nu.user_name, 'Unknown')
      ))
      FROM nano_user nu
      WHERE nu.uid = ANY(
        SELECT jsonb_array_elements_text(na.assigned_to4::jsonb)
        FROM nano_appointment na
        WHERE na.lead_id = ns.lead_id
        LIMIT 1
      )
    ) AS assigned_users_info,
    (
      SELECT id
      FROM nano_payment_log npl
      WHERE npl.sales_id = ns.id
      ORDER BY npl.id DESC
      LIMIT 1
    ) AS payid
  FROM nano_sales ns
  JOIN nano_leads nl ON nl.id = ns.lead_id
LEFT JOIN nano_user nu ON nl.sales_coordinator = nu.uid
  WHERE EXISTS (
    SELECT 1
    FROM nano_sales_package nsp
    WHERE nsp.sales_id = ns.id
    AND nsp.maintain_exist = true
  )
  AND ns.created_date BETWEEN $1 AND $2`;

    const baseResult = await pool.query(baseQuery, [
      req.body.from_date,
      req.body.to_date
    ]);

    // Process and sort the data in Node.js
    const processedData = baseResult.rows.map(row => {
      let nextMaintenanceDate = null;

      if (row.packages && row.packages.length > 0) {
        const allDates = row.packages.flatMap(pkg =>
          pkg.maintain_date ? pkg.maintain_date.map(d => d.date) : []
        );

        if (allDates.length > 0) {
          nextMaintenanceDate = Math.min(...allDates);
        }
      }

      return {
        ...row,
        next_maintenance_date: nextMaintenanceDate,
        // Add formatted date for display
        next_maintenance_date_formatted: nextMaintenanceDate ? new Date(nextMaintenanceDate).toLocaleDateString() : 'Not scheduled'
      };
    });

    // Sort by maintenance date
    processedData.sort((a, b) => {
      if (a.next_maintenance_date === null) return 1;
      if (b.next_maintenance_date === null) return -1;
      return a.next_maintenance_date - b.next_maintenance_date;
    });

    return res.status(200).send({
      data: processedData,
      success: true
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      message: 'Error fetching maintenance list',
      success: false
    });
  }
});

app.post('/getMaintenanceListPM', async (req, res) => {
  console.log('getMaintenanceListPM');

  try {
    // First get all maintenance records
    const baseQuery = `
      SELECT 
        ns.*,
        nl.*,
        (
          SELECT JSON_AGG(nsp)
          FROM nano_sales_package nsp
          WHERE nsp.sales_id = ns.id
          AND nsp.maintain_exist = true
        ) AS packages,
        (
          SELECT REGEXP_REPLACE(ssf.serviceform, '.*/(SER-NANO-[^-]+).*', '\\1')
          FROM (
              SELECT DISTINCT ON (lead_id) lead_id, serviceform
              FROM subcon_service_form
              WHERE lead_id = ns.lead_id
              ORDER BY lead_id, serviceform DESC
          ) AS ssf
      ) AS ser_num
      FROM nano_sales ns
      JOIN nano_leads nl ON nl.id = ns.lead_id
      WHERE EXISTS (
        SELECT 1
        FROM nano_sales_package nsp
        WHERE nsp.sales_id = ns.id
        AND nsp.maintain_exist = true
      )
      AND ns.created_date BETWEEN $1 AND $2
      AND ns.pending_subcon = $3::text
    `;

    const baseResult = await pool.query(baseQuery, [
      req.body.from_date,
      req.body.to_date,
      req.body.company
    ]);

    // Process and sort the data in Node.js
    const processedData = baseResult.rows.map(row => {
      let nextMaintenanceDate = null;

      if (row.packages && row.packages.length > 0) {
        const allDates = row.packages.flatMap(pkg =>
          pkg.maintain_date ? pkg.maintain_date.map(d => d.date) : []
        );

        if (allDates.length > 0) {
          nextMaintenanceDate = Math.min(...allDates);
        }
      }

      return {
        ...row,
        next_maintenance_date: nextMaintenanceDate
      };
    });

    // Sort by maintenance date
    processedData.sort((a, b) => {
      if (a.next_maintenance_date === null) return 1;
      if (b.next_maintenance_date === null) return -1;
      return a.next_maintenance_date - b.next_maintenance_date;
    });

    return res.status(200).send({
      data: processedData,
      success: true
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      message: 'Error fetching maintenance list',
      success: false
    });
  }
});

app.post('/getMaintenanceListSE', async (req, res) => {
  console.log('getMaintenanceListSE');

  try {
    const currentUserUid = req.body.uid; // Make sure to pass this from frontend

    // First get all maintenance records for the current user
    const baseQuery = `SELECT 
    ns.*, 
    nl.*, ns.id as sales_id,
    nu.user_name AS sc_name,
    (
      SELECT JSON_AGG(nsp)
      FROM nano_sales_package nsp
      WHERE nsp.sales_id = ns.id
      AND nsp.maintain_exist = true
    ) AS packages,
    (
      SELECT REGEXP_REPLACE(ssf.serviceform, '.*/(SER-NANO-[^-]+).*', '\\1')
      FROM (
        SELECT DISTINCT ON (lead_id) lead_id, serviceform
        FROM subcon_service_form
        WHERE lead_id = ns.lead_id
        ORDER BY lead_id, serviceform DESC
      ) AS ssf
    ) AS ser_num,
    (
      SELECT na.assigned_to4
      FROM nano_appointment na
      WHERE na.lead_id = ns.lead_id
      LIMIT 1
    ) AS assigned_to4,
    (
      SELECT JSON_AGG(json_build_object(
        'uid', nu.uid,
        'name', COALESCE(nu.user_name, 'Unknown')
      ))
      FROM nano_user nu
      WHERE nu.uid = ANY(
        SELECT jsonb_array_elements_text(na.assigned_to4::jsonb)
        FROM nano_appointment na
        WHERE na.lead_id = ns.lead_id
        LIMIT 1
      )
    ) AS assigned_users_info,
    (
      SELECT id
      FROM nano_payment_log npl
      WHERE npl.sales_id = ns.id
      ORDER BY npl.id DESC
      LIMIT 1
    ) AS payid
  FROM nano_sales ns
  JOIN nano_leads nl ON nl.id = ns.lead_id
  LEFT JOIN nano_user nu ON nl.sales_coordinator = nu.uid
  WHERE EXISTS (
    SELECT 1
    FROM nano_sales_package nsp
    WHERE nsp.sales_id = ns.id
    AND nsp.maintain_exist = true
  )
  AND ns.created_date BETWEEN $1 AND $2
  AND EXISTS (
    SELECT 1
    FROM nano_appointment na
    WHERE na.lead_id = ns.lead_id
    AND na.assigned_to4::jsonb ? $3
  )`;

    const baseResult = await pool.query(baseQuery, [
      req.body.from_date,
      req.body.to_date,
      currentUserUid
    ]);

    // Process and sort the data in Node.js
    const processedData = baseResult.rows.map(row => {
      let nextMaintenanceDate = null;

      if (row.packages && row.packages.length > 0) {
        const allDates = row.packages.flatMap(pkg =>
          pkg.maintain_date ? pkg.maintain_date.map(d => d.date) : []
        );

        if (allDates.length > 0) {
          nextMaintenanceDate = Math.min(...allDates);
        }
      }

      return {
        ...row,
        next_maintenance_date: nextMaintenanceDate,
        // Add formatted date for display
        next_maintenance_date_formatted: nextMaintenanceDate ? new Date(nextMaintenanceDate).toLocaleDateString() : 'Not scheduled'
      };
    });

    // Sort by maintenance date
    processedData.sort((a, b) => {
      if (a.next_maintenance_date === null) return 1;
      if (b.next_maintenance_date === null) return -1;
      return a.next_maintenance_date - b.next_maintenance_date;
    });

    return res.status(200).send({
      data: processedData,
      success: true
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      message: 'Error fetching maintenance list',
      success: false
    });
  }
});

app.post('/getCompletedTaskListPM3', async (req, res) => {
  console.log('getCompletedTaskListPM3')

  pool.query(`WITH selectdata AS (SELECT ns.lead_id, ns.final_approval,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('sap_id', sap_id ))
   FROM nano_sales_package nsp LEFT JOIN nano_packages np ON nsp.package_id = np.id  WHERE sales_id = ns.id ) AS sap,

   JSON_ARRAY_ELEMENTS_TEXT(nsp.from_date2) AS schedule_date

  FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id WHERE
   ns.subcon_state = 'Accepted' AND (ns.status = true OR (ns.status = false AND ns.is_complaint = true)) AND ns.pending_subcon = $3::text )
  SELECT * FROM selectdata WHERE schedule_date::BIGINT >= $1 AND schedule_date::BIGINT <= $2`
    , [req.body.from_date, req.body.to_date, req.body.company]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true });

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

app.post('/getTaskListPA', async (req, res) => {
  console.log('getTaskListPA')

  pool.query(`WITH sales_data AS (
    SELECT 
        ns.id AS sales_id, ns.lead_id, ns.assigned_worker AS worker, ns.status, ns.final_approval, ns.is_complaint, ns.task_completed_date AS completed_date, nl.customer_name, 
        nl.customer_phone, nl.customer_state, nl.customer_city, nl.address, nl.services, nsp.from_date2 AS schedule_dates, nl.id AS lead_id,
        ( SELECT JSON_AGG(JSON_BUILD_OBJECT(
                    'sap_id', sap_id, 'place', nsp.area, 'service', np.service, 'remark', nsp.remark, 'task', nsp.task, 'from_date', nsp.from_date, 
                    'from_date2', nsp.from_date2, 'sub_completed', nsp.sub_completed, 'sub_total', nsp.sub_total, 'total', nsp.total, 
                    'discount', nsp.discount, 'services', nsp.services, 'sqft', nsp.sqft, 'size', nsp.size, 'rate', nsp.rate, 'other_area', nsp.other_area
                ))
            FROM nano_sales_package nsp LEFT JOIN nano_packages np ON nsp.package_id = np.id WHERE nsp.sales_id = ns.id
        ) AS sap, 
        ssf_data.ser_num AS ser_num, ssf_data.form_approval AS form_approval, ssf_data.form_status AS form_status, ssf_data.created_date AS form_date,
        COALESCE((SELECT JSON_AGG(nsc.created_date) FROM nano_sub_complaint nsc WHERE nsc.lead_id = nl.id), '[]') AS complaint_date
    FROM nano_sales ns
    LEFT JOIN nano_leads nl ON ns.lead_id = nl.id
    LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id
    LEFT JOIN LATERAL (
        SELECT REGEXP_REPLACE(ssf.serviceform, '.*/(SER-NANO-[^-]+).*', '\\1') AS ser_num, ssf.form_approval, ssf.form_status, ssf.created_date
        FROM subcon_service_form ssf
        WHERE ssf.lead_id = ns.lead_id
        ORDER BY ssf.lead_id, ssf.serviceform DESC
        LIMIT 1
    ) ssf_data ON true WHERE ns.subcon_state = 'Accepted' AND ns.status IS NOT NULL
)
SELECT * FROM sales_data WHERE ser_num IS NOT NULL AND final_approval IS TRUE AND EXISTS (
        SELECT 1 FROM JSON_ARRAY_ELEMENTS_TEXT(schedule_dates) AS schedule_date WHERE schedule_date::BIGINT >= $1 AND schedule_date::BIGINT <= $2
    )
ORDER BY completed_date DESC NULLS LAST;

`
    , [req.body.from_date, req.body.to_date]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

// (SELECT * FROM
//   (SELECT JSON_AGG(JSON_BUILD_OBJECT('schedule_date', schedule_date::bigint)) FROM
//   (SELECT schedule_date FROM nano_schedule WHERE sales_id = $1 ORDER BY schedule_date ASC) p) agg) AS schedule,
app.post('/getSpecificLDetailPM', async (req, res) => {
  console.log('getSpecificLDetailPM');

  pool.query(`SELECT ns.id AS sales_id,  nl.customer_name, nl.payment_mode, nl.customer_phone, nl.customer_email, nl.icno,  nl.company_name, nl.mailing_address, nl.residence_type, nl.residential_status, nl.address, ns.assigned_worker AS worker, ns.sub_sub_sign , 
  ns.total ,ns.sub_cust_sign, ns.status, ns.sales_status, ns.assigned_worker, nl.id AS lead_id, nsf.serviceform, nsf.id as serviceformid,
  na.assigned_to4, nso.created_date as sof_created_date, ns.task_completed_date,
  
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('checkid', sci.id, 'sales_id', sci.sales_id, 'check_in', sci.checkin_time, 
									 'check_out', sci.check_out) ORDER BY sci.id DESC) FROM sub_check_in sci
   WHERE sci.sales_id = ns.id) AS check_detail,
  
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('sap_id', sap_id, 'name', np.name, 'area', nsp.area, 'service', np.service, 'remark', nsp.remark,
   'task', nsp.task, 'from_date', nsp.from_date,  'from_date2', nsp.from_date2, 'sub_completed', nsp.sub_completed, 'sub_total', nsp.sub_total, 'total', nsp.total, 'discount', nsp.discount,
   'services', nsp.services, 'sqft', nsp.sqft, 'size', nsp.size, 'rate', nsp.rate, 'other_area', nsp.other_area, 'warranty', nsp.package_warranty, 'pu_status', nsp.pu_status,
   'package', nsp.package_details, 'maintain_exist', nsp.maintain_exist, 'maintain_confirm', nsp.maintain_confirm, 'maintain_date', nsp.maintain_date)) FROM nano_sales_package nsp LEFT JOIN 
   nano_packages np ON nsp.package_id = np.id  WHERE sales_id = ns.id) AS sap,

   (SELECT JSON_AGG(JSON_BUILD_OBJECT('user_name', user_name, 'user_phone_no', user_phone_no, 'user_email', user_email))
    FROM sub_user
    WHERE uid IN (
        SELECT jsonb_array_elements(assigned_worker::jsonb) ->> 'uid'
        FROM nano_sales WHERE id = $1
    ))  AS assigned_worker,

    (SELECT * FROM
      (SELECT JSON_AGG(JSON_BUILD_OBJECT('schedule_remark', remark)) FROM
      (SELECT remark FROM nano_schedule WHERE sales_id = $1 ORDER BY schedule_date ASC) p) agg) AS schedule_remarks,

      nso.id as sales_order_number

  FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id LEFT JOIN nano_appointment na ON nl.id = na.lead_id
  LEFT JOIN subcon_service_form nsf ON ns.id = nsf.sales_id LEFT JOIN nano_sales_order nso ON nso.lead_id = nl.id
  WHERE ns.id = $1`, [req.body.sales_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

// uploadserviceform
app.post('/uploadServiceForm', (req, res) => {
  console.log('uploadServiceForm')
  let quoteid = req.body.quoteid
  console.log(quoteid)
  let now = new Date().getTime()
  let now2 = new Date().getTime()

  // if (quoteid) {

  // pool.query(`With updateform as (UPDATE subcon_service_form SET(created_date, serviceform) = ($1, $2) WHERE id = $3 RETURNING id)
  //   SELECT * FROM updateform`, [now, req.body.latest_serviceform, quoteid]).then((result) => {
  //   return res.status(200).send({ success: true })

  // }).catch((error) => {
  //   console.log(error)
  //   return res.status(800).send({ success: false })
  // })

  // }
  // else {

  pool.query(`With updateform as (INSERT INTO subcon_service_form (created_date, serviceform, lead_id, appointment_id, sales_id) VALUES ($1, $2, $3, $4, $5) RETURNING id)
   
      SELECT * FROM updateform`, [now, req.body.latest_serviceform, req.body.lead_id, req.body.appointment_id, req.body.sales_id]).then((result) => {
    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

  // }

})

app.post('/uploadWarrantyForm', (req, res) => {
  console.log('uploadWarrantyForm')
  let quoteid = req.body.quoteid
  console.log(quoteid)
  let now = new Date().getTime()
  let now2 = new Date().getTime()

  pool.query(`With updateform as (INSERT INTO nano_warranty_form (date_created, warrantyform, lead_id, appointment_id, sales_id) VALUES ($1, $2, $3, $4, $5) RETURNING id)
      SELECT * FROM updateform`, [now, req.body.warrantyform, req.body.lead_id, req.body.appointment_id, req.body.sales_id]).then((result) => {
    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

  // }

})

app.post('/getServiceFormnumber', (req, res) => {
  console.log('getServiceFormnumber')
  // let now = new Date().getTime()

  pool.query(`SELECT COUNT(*) as sofkey, (SELECT id from subcon_service_form WHERE sales_id = $1) FROM subcon_service_form`, [req.body.sales_id]).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/getServiceFormByLead', (req, res) => {
  console.log('getServiceFormnumber')
  // let now = new Date().getTime()

  pool.query(`SELECT * from subcon_service_form WHERE lead_id = $1 ORDER BY id DESC`, [req.body.lead_id]).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/getWarrantyFormByLead', (req, res) => {
  console.log('getWarrantyFormByLead')
  // let now = new Date().getTime()

  pool.query(`SELECT * from nano_warranty_form WHERE lead_id = $1 ORDER BY id DESC`, [req.body.lead_id]).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

// uploadcomplaintform
app.post('/uploadComplaintForm', (req, res) => {
  console.log('uploadComplaintForm')

  let now = new Date().getTime()

  pool.query(`With updateform as (INSERT INTO subcon_complaint_form (date_created, complaintform, lead_id, sales_id) VALUES ($1, $2, $3, $4) RETURNING id)
   SELECT * FROM updateform`, [now, req.body.latest_complaintform, req.body.lead_id, req.body.sales_id]).then((result) => {
    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/getComplaintFormByLead', (req, res) => {
  console.log('getComplaintFormByLead')

  pool.query(`SELECT * from subcon_complaint_form WHERE lead_id = $1 ORDER BY id DESC`, [req.body.lead_id]).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})



//All task api
app.post('/getMonthTaskForAll', async (req, res) => {
  console.log('getMonthTaskForAll');

  pool.query(`WITH selectdata AS (SELECT ns.id AS sales_id , ns.assigned_worker AS worker, ns.status, nsp.from_date, 
    JSON_ARRAY_ELEMENTS_TEXT(nsp.from_date2) as from_date2
      FROM nano_sales ns LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id
      WHERE $1::text IN 
      (SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj) 
      AND ns.subcon_state::text = 'Accepted')
      SELECT * FROM selectdata WHERE from_date2::BIGINT >= $2 and from_date2::BIGINT <= $3`, [req.body.uid, req.body.startdate, req.body.enddate]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/getTaskListForAll', async (req, res) => {
  console.log('getTaskListForAll');
  // LbdDaz3w3yPFVjTEQVr6PbGP3PC3

  pool.query(`WITH selectdata AS (SELECT nl.customer_name, nl.customer_phone, nl.address, ns.id AS sales_id, ns.assigned_worker AS worker, ns.status, ns.final_approval,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('sap_id', sap_id, 'place', nsp.area, 'service', np.service, 'remark', nsp.remark,
  'task', nsp.task, 'from_date', nsp.from_date,  'from_date2', nsp.from_date2, 'sub_completed', nsp.sub_completed, 'sub_total', nsp.sub_total, 'total', nsp.total, 'discount', nsp.discount,
  'services', nsp.services, 'sqft', nsp.sqft, 'size', nsp.size, 'rate', nsp.rate, 'other_area', nsp.other_area ))
   FROM nano_sales_package nsp LEFT JOIN nano_packages np ON nsp.package_id = np.id  WHERE sales_id = ns.id ) AS sap,

   JSON_ARRAY_ELEMENTS_TEXT(nsp.from_date2) AS schedule_date,

  (SELECT j.value ->> 'role' FROM nano_sales s, JSON_ARRAY_ELEMENTS(assigned_worker) j 
  WHERE j.value ->> 'uid' = $1  AND s.id = ns.id) AS role

  FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id LEFT JOIN nano_sales_package nsp ON ns.id = nsp.sales_id WHERE $1::text IN 
  (SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj)
  AND ns.subcon_state = 'Accepted')
  SELECT * FROM selectdata WHERE schedule_date::BIGINT >= $2 AND schedule_date::BIGINT <= $3 ORDER BY schedule_date::bigint ASC`
    , [req.body.uid, req.body.from_date, req.body.to_date]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

//remark, date, task list
app.post('/getLDetailForSubConApp2', async (req, res) => {
  console.log('getLDetailForSubConApp2');
  // LbdDaz3w3yPFVjTEQVr6PbGP3PC3

  pool.query(`SELECT nl.customer_name, nl.customer_phone, nl.address, ns.id AS sales_id, ns.assigned_worker AS worker, ns.status,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('sap_id', sap_id, 'place', nsp.area, 'service', np.service, 'remark', nsp.remark,
  'task', nsp.task, 'from_date', nsp.from_date,  'from_date2', nsp.from_date2, 'sub_completed', nsp.sub_completed, 'sub_total', nsp.sub_total, 'total', nsp.total, 'discount', nsp.discount,
  'services', nsp.services, 'sqft', nsp.sqft, 'size', nsp.size, 'rate', nsp.rate, 'other_area', nsp.other_area ))
   FROM nano_sales_package nsp LEFT JOIN nano_packages np ON nsp.package_id = np.id  WHERE sales_id = ns.id ) AS sap,

  (SELECT * FROM
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('schedule_date', schedule_date::bigint)) FROM
  (SELECT schedule_date FROM nano_schedule WHERE sales_id = ns.id ORDER BY schedule_date ASC) p) agg) AS schedule,

  (SELECT j.value ->> 'role' FROM nano_sales s, JSON_ARRAY_ELEMENTS(assigned_worker) j 
  WHERE j.value ->> 'uid' = $1  AND s.id = ns.id) AS role

  FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id WHERE $1::text IN 
  (SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj)
  AND (SELECT COUNT(schedule_date) FROM nano_schedule WHERE sales_id = ns.id AND schedule_date >= $2::text AND schedule_date <= $3::text ) > 0`
    , [req.body.uid, req.body.from_date, req.body.to_date]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})


app.post('/getCompletedLDetailForSubConApp', async (req, res) => {
  console.log('getCompletedLDetailForSubConApp');
  // LbdDaz3w3yPFVjTEQVr6PbGP3PC3

  pool.query(`SELECT nl.customer_name, nl.customer_phone, nl.address, ns.id AS sales_id, ns.assigned_worker AS worker, ns.status as status,
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('sap_id', sap_id, 'place', nsp.area, 'service', np.service, 'remark', nsp.remark,
  'task', nsp.task, 'from_date', nsp.from_date,  'from_date2', nsp.from_date2, 'sub_completed', nsp.sub_completed, 'sub_total', nsp.sub_total, 'total', nsp.total, 'discount', nsp.discount,
  'services', nsp.services, 'sqft', nsp.sqft, 'size', nsp.size, 'rate', nsp.rate, 'other_area', nsp.other_area ))
   FROM nano_sales_package nsp LEFT JOIN nano_packages np ON nsp.package_id = np.id  WHERE sales_id = ns.id ) AS sap,

  (SELECT * FROM
  (SELECT JSON_AGG(JSON_BUILD_OBJECT('schedule_date', schedule_date::bigint)) FROM
  (SELECT schedule_date FROM nano_schedule WHERE sales_id = ns.id ORDER BY schedule_date ASC) p) agg) AS schedule,

  (SELECT j.value ->> 'role' FROM nano_sales s, JSON_ARRAY_ELEMENTS(assigned_worker) j 
  WHERE j.value ->> 'uid' = $1  AND s.id = ns.id) AS role

  FROM nano_sales ns LEFT JOIN nano_leads nl ON ns.lead_id = nl.id WHERE $1::text IN 
  (SELECT REPLACE(bj.value ->> 'uid'::varchar(100), '"', '') FROM JSON_ARRAY_ELEMENTS(ns.assigned_worker) bj)
  AND (SELECT COUNT(schedule_date) FROM nano_schedule WHERE sales_id = ns.id AND schedule_date >= $2::text AND schedule_date <= $3::text ) > 0 AND ns.status = true`
    , [req.body.uid, req.body.from_date, req.body.to_date]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

//need what info okok
//macam itu getLDetailForSubConAPP2 but no time limit
//tambah satu get all task for sub con app
// customer name, phone, address, project manager remark, task_place, service
app.post('/getSpecificLDetailForSub', async (req, res) => {
  console.log('getSpecificLDetailForSub');

  pool.query(`SELECT ns.id AS sales_id, nl.customer_name, nl.customer_phone, nl.address, ns.assigned_worker AS worker, 
  ns.sub_sub_sign, ns.total, ns.sub_cust_sign, ns.status, ns.sales_status, nl.id AS lead_id, ns.task_status, 
  ns.final_reject_remark, ns.final_approval, na.assigned_to4, ns.scaff_fee, ns.skylift_fee, ns.selected_photo,

  (SELECT JSON_AGG(JSON_BUILD_OBJECT('checkid', sci.id, 'sales_id', sci.sales_id, 'check_in', sci.checkin_time, 
                                     'check_out', sci.check_out, 'check_useruid', sci.check_useruid) ORDER BY sci.id DESC) 
   FROM sub_check_in sci
   WHERE sci.sales_id = ns.id) AS check_detail,

  (SELECT JSON_AGG(
      JSON_BUILD_OBJECT(
        'sap_id', nsp.sap_id, 
        'place', nsp.area, 
        'service', np.service, 
        'remark', nsp.remark,
        'task', nsp.task, 
        'from_date', nsp.from_date,  
        'from_date2', nsp.from_date2,
        'from_date3', nsp.from_date3, 
        'sub_completed', nsp.sub_completed, 
        'sub_total', nsp.sub_total, 
        'total', nsp.total, 
        'discount', nsp.discount,
        'services', nsp.services, 
        'sqft', nsp.sqft, 
        'size', nsp.size, 
        'rate', nsp.rate, 
        'other_area', nsp.other_area, 
        'is_complaint', nsp.is_complaint, 
        'pu_status', nsp.pu_status, 
        'complaint_remark', nsc.complaint_remark
      )
    )
   FROM nano_sales_package nsp 
   LEFT JOIN nano_packages np ON nsp.package_id = np.id  
   LEFT JOIN LATERAL (
      SELECT nsc.complaint_remark
      FROM nano_sub_complaint nsc
      WHERE nsc.sales_id = ns.id 
        AND nsc.complaint_id::jsonb @> JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('sap_id', nsp.sap_id))
      ORDER BY nsc.id DESC LIMIT 1
   ) nsc ON true
   WHERE nsp.sales_id = ns.id
  ) AS sap,

  (SELECT JSON_AGG(JSON_BUILD_OBJECT('schedule_date', schedule_date::bigint))
   FROM (SELECT schedule_date FROM nano_schedule WHERE sales_id = $1 ORDER BY schedule_date ASC) p) AS schedule,

  (SELECT JSON_AGG(JSON_BUILD_OBJECT('name', u.user_name, 'phone', u.user_phone_no)) 
   FROM nano_user u
   WHERE u.uid IN (SELECT value::text FROM JSONB_ARRAY_ELEMENTS_TEXT(na.assigned_to4::JSONB))) AS user_info

FROM nano_sales ns
LEFT JOIN nano_leads nl ON ns.lead_id = nl.id 
LEFT JOIN nano_appointment na ON nl.id = na.lead_id
WHERE ns.id = $1;
`, [req.body.sales_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/getSpecificLDetailForSub2', async (req, res) => {
  console.log('getSpecificLDetailForSub2');

  pool.query(`SELECT ns.id AS sales_id, nl.customer_name, nl.customer_phone, nl.address, ns.assigned_worker AS worker, 
  ns.sub_sub_sign, ns.total, ns.sub_cust_sign, ns.status, ns.sales_status, nl.id AS lead_id, ns.task_status, 
  ns.final_reject_remark, ns.final_approval, na.assigned_to4, ns.scaff_fee, ns.skylift_fee, ns.selected_photo, ns.m_state,

  (SELECT JSON_AGG(JSON_BUILD_OBJECT('checkid', sci.id, 'sales_id', sci.sales_id, 'check_in', sci.checkin_time, 
                                     'check_out', sci.check_out, 'check_useruid', sci.check_useruid) ORDER BY sci.id DESC) 
   FROM sub_check_in sci
   WHERE sci.sales_id = ns.id) AS check_detail,

   (SELECT JSON_AGG(
    TO_JSONB(nsp)
      || JSONB_BUILD_OBJECT(
        'service', np.service,
        'complaint_remark', nsc.complaint_remark
      )
  )
 FROM nano_sales_package nsp
 LEFT JOIN nano_packages np ON nsp.package_id = np.id  
 LEFT JOIN LATERAL (
   SELECT nsc.complaint_remark
   FROM nano_sub_complaint nsc
   WHERE nsc.sales_id = ns.id 
     AND nsc.complaint_id::jsonb @> JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('sap_id', nsp.sap_id))
   ORDER BY nsc.id DESC LIMIT 1
 ) nsc ON true
 WHERE nsp.sales_id = ns.id
) AS sap,

  (SELECT JSON_AGG(JSON_BUILD_OBJECT('schedule_date', schedule_date::bigint))
   FROM (SELECT schedule_date FROM nano_schedule WHERE sales_id = $1 ORDER BY schedule_date ASC) p) AS schedule,

  (SELECT JSON_AGG(JSON_BUILD_OBJECT('name', u.user_name, 'phone', u.user_phone_no)) 
   FROM nano_user u
   WHERE u.uid IN (SELECT value::text FROM JSONB_ARRAY_ELEMENTS_TEXT(na.assigned_to4::JSONB))) AS user_info

FROM nano_sales ns
LEFT JOIN nano_leads nl ON ns.lead_id = nl.id 
LEFT JOIN nano_appointment na ON nl.id = na.lead_id
WHERE ns.id = $1;
`, [req.body.sales_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

//update subcon completed work
app.post('/updateSubCompleted', async (req, res) => {
  console.log('updateSubCompleted');

  pool.query(`UPDATE nano_sales_package SET sub_completed = sub_completed::jsonb || $1::jsonb, sub_image = $2, sub_video = $3, sub_remark = $4 WHERE sap_id = $5`,
    [req.body.sub_completed, req.body.sub_image, req.body.sub_video, req.body.sub_remark, req.body.sap_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

app.post('/updateSubCompleted2', async (req, res) => {
  console.log('updateSubCompleted2');
  if (!req.body.sub_complaint_image) {
    req.body.sub_complaint_image = JSON.stringify([])
  }
  if (!req.body.sub_complaint_video) {
    req.body.sub_complaint_video = JSON.stringify([])
  }
  if (req.body.sub_complaint_remark == null) {
    req.body.sub_complaint_remark = JSON.stringify([])
  }
  let now = new Date().getTime()
  pool.query(`
  SELECT user_name FROM sub_user WHERE uid = $1
`, [req.body.uid]).then((result) => {
    let by = result.rows[0]['user_name']

    pool.query(`WITH updatesaptask AS (UPDATE nano_sales_package SET 
      sub_completed = sub_completed::jsonb || $1::jsonb, 
      sub_image = $2, 
      sub_video = $3,
      sub_complaint_image = $12,
      sub_complaint_video = $13, 
      sub_remark = $4,
      sub_complaint_remark = $14 
      WHERE sap_id = $5 RETURNING *),
    insertactivitylog as (INSERT INTO nano_activity_log (lead_id, sales_id, activity_time, activity_by, remark, 
      activity_type) VALUES ($6, $7 ,$8, $9, $10, $11))
    SELECT * FROM updatesaptask`,
      [req.body.sub_completed, req.body.sub_image, req.body.sub_video, req.body.sub_remark, req.body.sap_id, req.body.lead_id, req.body.sales_id, now, req.body.uid,
      'Task ' + req.body.area + ' has been Updated by ' + by, 'Subcon/Task', req.body.sub_complaint_image, req.body.sub_complaint_video, req.body.sub_complaint_remark]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ message: error, success: false })
      })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/updateSubCompleted3', async (req, res) => {
  console.log('updateSubCompleted3');
  if (!req.body.sub_complaint_image) {
    req.body.sub_complaint_image = JSON.stringify([])
  }
  if (!req.body.sub_complaint_video) {
    req.body.sub_complaint_video = JSON.stringify([])
  }
  if (req.body.sub_complaint_remark == null) {
    req.body.sub_complaint_remark = JSON.stringify([])
  }
  let now = new Date().getTime()
  pool.query(`
  SELECT user_name FROM sub_user WHERE uid = $1
`, [req.body.uid]).then((result) => {
    let by = result.rows[0]['user_name']

    pool.query(`WITH updatesaptask AS (UPDATE nano_sales_package SET 
      sub_completed = sub_completed::jsonb || $1::jsonb, 
      sub_image = $2, 
      sub_video = $3,
      sub_complaint_image = $12,
      sub_complaint_video = $13, 
      sub_remark = $4,
      sub_complaint_remark = $14,
      sub_maintain_image = $15,
      sub_maintain_video = $16, 
      sub_maintain_remark = $17,
      maintain_status = $18
      maintain_complete = $19
      maintain_complete_date = $20
      WHERE sap_id = $5 RETURNING *),
    insertactivitylog as (INSERT INTO nano_activity_log (lead_id, sales_id, activity_time, activity_by, remark, 
      activity_type) VALUES ($6, $7 ,$8, $9, $10, $11))
    SELECT * FROM updatesaptask`,
      [req.body.sub_completed, req.body.sub_image, req.body.sub_video, req.body.sub_remark, req.body.sap_id, req.body.lead_id, req.body.sales_id, now, req.body.uid,
      'Task ' + req.body.area + ' has been Updated by ' + by, 'Subcon/Task', req.body.sub_complaint_image, req.body.sub_complaint_video, req.body.sub_complaint_remark,
      req.body.sub_maintain_image, req.body.sub_maintain_video, req.body.sub_maintain_remark, req.body.sub_maintain_status, req.body.maintain_complete, req.body.maintain_complete_date]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ message: error, success: false })
      })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/updateServiceForm', async (req, res) => {
  console.log('updateServiceForm');
  let date = new Date().getTime()

  pool.query(`UPDATE subcon_service_form SET form_approval = $2, form_reject_remark = $3, form_status = $4,  form_approval_date = $5 WHERE id = $1`,
    [req.body.id, req.body.form_approval, req.body.reject, req.body.form_status, date]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

app.post('/updateSubSubSign', async (req, res) => {
  console.log('updateSubSubSign');

  pool.query(`UPDATE nano_sales SET sub_sub_sign = $1 WHERE id = $2`,
    [req.body.sub_sub_sign, req.body.sales_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

app.post('/updateSubCustSign', async (req, res) => {
  console.log('updateSubCustSign');

  pool.query(`UPDATE nano_sales SET sub_cust_sign =  $1 WHERE id = $2`,
    [req.body.sub_cust_sign, req.body.sales_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

// customer sign external website
app.post('/updateCustSignSubcon', async (req, res) => {
  console.log('updateCustSignSubcon');

  pool.query(`UPDATE nano_sales SET sub_cust_sign =  $1 WHERE id = $2`,
    [req.body.customer_signature, req.body.sales_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

app.post('/updateCustSignSOF', (req, res) => {
  console.log('updateCustSignSOF');

  pool.query(`UPDATE nano_leads SET customer_signature = $1 WHERE id = $2`,
    [req.body.customer_signature, req.body.leadid]).then((result) => {

      return res.status(200).send({ message: 'update successfully', success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updateSpecificSubSign', async (req, res) => {
  console.log('updateSpecificSubSign');
  console.log(req.body);
  pool.query(`UPDATE nano_sales_package SET sub_sub_sign =  $1 WHERE sap_id = $2`,
    [req.body.sub_sub_sign, req.body.sap_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

app.post('/updateSpecificCustSign', async (req, res) => {
  console.log('updateSpecificCustSign');

  pool.query(`UPDATE nano_sales_package SET sub_customer_sign =  $1 WHERE sap_id = $2`,
    [req.body.sub_cust_sign, req.body.sap_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

app.post('/updateFinalStatus', async (req, res) => {
  console.log('updateFinalStatus');
  let now = new Date().getTime()
  pool.query(`
  SELECT user_name FROM sub_user WHERE uid = $1
`, [req.body.from_id]).then((result) => {
    let by = result.rows[0]['user_name']

    pool.query(`WITH updatestatus as (UPDATE nano_sales SET status = true, final_approval = null, task_completed_date = $4 WHERE id = $6 RETURNING *),
  insertnotificationhis as (INSERT INTO nano_notification_history (to_id, from_id, message_type, his_date, lead_id, sales_id, title, body) VALUES($1, $2, $3, $4, $5, $6, $7, $8)),
  insertactivitylog as (INSERT INTO nano_activity_log (lead_id, sales_id, activity_time, activity_by, remark, activity_type) 
  VALUES ($5, $6 ,$4, $2, $9, $10))
  SELECT * FROM updatestatus`,
      [req.body.to_id, req.body.from_id, req.body.message_type, now, req.body.lead_id, req.body.sales_id, req.body.title, req.body.body, 'All Task Done, Updated by ' + by, 'Subcon/TaskDone']).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ message: error, success: false })
      })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/updateMaintainFinal', async (req, res) => {
  console.log('updateMaintainFinal');
  let now = new Date().getTime()
  pool.query(`
  SELECT user_name FROM sub_user WHERE uid = $1
`, [req.body.from_id]).then((result) => {
    let by = result.rows[0]['user_name']

    pool.query(`WITH updatestatus as (UPDATE nano_sales SET status = true, final_approval = null, maintain_completed_date = $4 WHERE id = $6 RETURNING *),
  insertnotificationhis as (INSERT INTO nano_notification_history (to_id, from_id, message_type, his_date, lead_id, sales_id, title, body) VALUES($1, $2, $3, $4, $5, $6, $7, $8)),
  insertactivitylog as (INSERT INTO nano_activity_log (lead_id, sales_id, activity_time, activity_by, remark, activity_type) 
  VALUES ($5, $6 ,$4, $2, $9, $10))
  SELECT * FROM updatestatus`,
      [req.body.to_id, req.body.from_id, req.body.message_type, now, req.body.lead_id, req.body.sales_id, req.body.title, req.body.body, 'All Task Done, Updated by ' + by, 'Subcon/TaskDone']).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ message: error, success: false })
      })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})



//warranty
app.post('/getSpecificWarrantyWithWarrantyId', async (req, res) => {
  console.log('getSpecificWarrantyWithWarrantyId');

  pool.query(`SELECT * FROM nano_warranty WHERE id = $1`, [req.body.warranty_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

//Payment Method
app.get('/getAllPMethod', async (req, res) => {
  console.log('getAllPMethod');

  pool.query(`SELECT * FROM nano_payment_method`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/getSPMethod', async (req, res) => {
  console.log('getSPMethod');

  pool.query(`SELECT * FROM nano_payment_method where id = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})


app.post('/createPMethod', async (req, res) => {
  console.log('createPMethod');

  let create_date = new Date().getTime()

  pool.query(`INSERT INTO nano_payment_method(name, update_date, created_date, status) VALUES ($1, null, $2, true)`, [req.body.name, create_date]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})


app.post('/updatePMethod', async (req, res) => {
  console.log('updatePMethod');

  let update_date = new Date().getTime()

  pool.query(`UPDATE nano_payment_method SET (name, update_date, status) = ($1, $2, $3) WHERE id = $4`, [req.body.name, update_date, req.body.status, req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})


//sales_package_discount
app.post('/getSalesPackageBySapid', (req, res) => {
  console.log('getSalesPackageBySapid')

  pool.query(`SELECT *, nsl.area as area2, nsl.sqft as sqft2
  FROM nano_sales_package nsl LEFT JOIN nano_packages ns ON nsl.package_id = ns.id LEFT JOIN nano_sales_package_discount c ON nsl.package_id = c.dis_id WHERE nsl.sap_id = $1 OR nsl.addon_id = $1 ORDER BY nsl.sap_id ASC`, [req.body.sap_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/AddNewSalesPackageDiscountWritten', (req, res) => {
  console.log('AddNewSalesPackageDiscountWritten');
  req.body.photo = JSON.stringify([])
  pool.query(` WITH insertdiscount as (INSERT INTO nano_sales_package_discount (dis_name, dis_remark, dis_percentage, need_photo, photo, sales_package_id, dis_type, status)
  VALUES($1, $2, $3, $4, $5, $6, $7, true) RETURNING *),
  afterprice as (UPDATE nano_sales_package SET total_after = $8 WHERE sap_id = $6)
  SELECT * FROM insertdiscount
  `,
    [req.body.name, req.body.remark, req.body.percentage, req.body.need_photo, req.body.photo, req.body.sapid, req.body.type, req.body.total_after]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


app.post('/deleteSalesPackageDiscount', (req, res) => {
  console.log('deleteSalesPackageDiscount');
  req.body.photo = JSON.stringify([])
  pool.query(` UPDATE nano_sales_package_discount SET status = false WHERE dis_id = $1`,
    [req.body.dis_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


app.post('/updateSalesPackageAfterTotal', (req, res) => {
  console.log('updateSalesPackageAfterTotal');
  // req.body.photo = JSON.stringify([])
  pool.query(`UPDATE nano_sales_package SET total_after = $2 WHERE sap_id = $1`,
    [req.body.sapid, req.body.total_after]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/getNotificationHistory', (req, res) => {
  console.log('getNotificationHistory');
  // req.body.photo = JSON.stringify([])
  let thirtydaybefore = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0).getTime() - (86400000 * 30)
  pool.query(`SELECT a.*, b.customer_name, b.customer_phone, c.id as task_id, ne.event_title, ne.starttime FROM nano_notification_history a LEFT JOIN  nano_leads b ON a.lead_id = b.id LEFT JOIN nano_appointment c ON c.lead_id = a.lead_id 
  LEFT JOIN nano_event ne ON ne.no = a.event_id 
  WHERE to_id = $1 AND his_date >= $2 ORDER BY his_date DESC`,
    [req.body.uid, thirtydaybefore]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/insertNotificationHistory', (req, res) => {
  console.log('insertNotificationHistory');
  // req.body.photo = JSON.stringify([])
  let now = new Date().getTime()
  pool.query(`INSERT INTO nano_notification_history (to_id, from_id, message_type, his_date, lead_id, sales_id, event_id, title, body) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [req.body.to_id, req.body.from_id, req.body.message_type, now, req.body.lead_id, req.body.sales_id, req.body.event_id, req.body.title, req.body.body]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


app.post('/bulkInsert', async (req, res) => {
  console.log('bulkInsert');


  let arr = await req.body.map(e => JSON.parse(JSON.stringify(Object.keys(e).sort().reduce((r, k) => (r[k] = e[k], r), {}))))
  let body = Object.entries(arr[0])
  let variables = body.map(e => e[0]).join(',')
  let values2 = await arr.map(e => (Object.values(e).map((a, i) => a)))

  console.log(variables)
  console.log(values2)

  // pool.query(format('INSERT INTO nano_leads(' + variables + ') VALUES %L', values2), []).then((result) => {

  //   return res.status(200).send({ success: true })

  // }).catch((error) => {
  //   console.log(error)
  //   return res.status(800).send({ success: false })
  // })
  return res.status(200).send({ success: true })

})

app.post('/bulkInsert2', async (req, res) => {
  console.log('bulkInsert2');

  let arr = await req.body.map(e => JSON.parse(JSON.stringify(Object.keys(e).sort().reduce((r, k) => (r[k] = e[k], r), {}))))
  let body = Object.entries(arr[0])
  let variables = body.map(e => e[0]).join(',')
  let values2 = await arr.map(e => (Object.values(e).map((a, i) => a)))

  console.log(body)
  console.log(variables)
  console.log(values2)

  pool.query(format('INSERT INTO nano_appointment(' + variables + ') VALUES %L', values2), []).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/bulkInsert3', async (req, res) => {



  pool.query(`UPDATE nano_appointment AS na SET 
  appointment_status = n.appointment_status, checkin = n.checkin, assigned_to4 = n.assigned_to4, checkin_address = n.checkin_address 
  FROM (SELECT (j.value ->> 'appointment_status')::BOOLEAN appointment_status, (j.value ->> 'assigned_to4') assigned_to4, (j.value ->> 'checkin') checkin ,
  (j.value ->> 'checkin_address') checkin_address ,   (j.value ->> 'lead_id')::BIGINT lead_id 
  FROM  JSONB_ARRAY_ELEMENTS($1::JSONB) j
  ) AS n WHERE n.lead_id = na.lead_id`, [JSON.stringify(req.body)]).then((result) => {

    console.log(result.rowCount)
    return res.status(200).send({ success: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })


})

app.post('/bulkupdate', async (req, res) => {



  pool.query(`UPDATE nano_leads AS na SET 
  fake_id = n.fake_id::BIGINT
  FROM (SELECT (j.value ->> 'fake_id') fake_id, (j.value ->> 'id') id
  FROM  JSONB_ARRAY_ELEMENTS($1::JSONB) j
  ) AS n WHERE n.id::BIGINT = na.id`, [JSON.stringify(req.body)]).then((result) => {

    console.log(result.rowCount)
    return res.status(200).send({ success: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })


})

app.post('/bulkInsert99', async (req, res) => {
  console.log('bulkInsert99');
  console.log(req.body)
  let body = req.body

  pool.query(`SELECT * from nano_leads where created_date::bigint >= 1691060554320 AND customer_phone = $1`, [body.customer_phone]).then((result) => {
    if (result.rowCount <= 0) {

      pool.query(`INSERT INTO nano_leads(created_date, customer_name, customer_email, customer_phone, channel_id, verified, status, label_m, label_s, remark_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [body.created_date, body.customer_name, body.customer_email, body.customer_phone, 'Archidex 23', true, true, 48, 2, body.remark_json]).then((result) => {
          console.log(result)
          if (result.rowCount > 0) {
            lead_id = result.rows[0]['id']
            !body.sales_exec ? body.sales_exec = JSON.stringify([]) : body.sales_exec
            // body.sales_exec = (!body.sales_exec || body.sales_exec == '{}' ) ? [] :  body.sales_exec
            // body.sales_exec = body.sales_exec ? body.sales_exec : []
            pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`, [body.date]).then((result) => {
              console.log(result.rows[0]);
              pool.query(`INSERT INTO nano_activity_log(lead_id, activity_time, activity_by, remark , activity_type) VALUES ($1, $2, $3, $4, $5)`,
                [lead_id, body.created_date, null, 'Lead created from ' + (result.rows.length > 0 ? result.rows[0]['user_name'] : 'Archidex 23'), 'Lead']).then((result) => {

                  pool.query(`INSERT INTO nano_appointment(lead_id, created_time, appointment_status) VALUES($1, $2, $3)`, [lead_id, body.created_date, true]).then((result) => {
                    let from = new Date().setHours(0, 0, 0, 0)
                    let to = new Date().setHours(23, 59, 59, 59)
                    if (body.coordinator == null) {
                      pool.query(`
                   WITH coord AS(
                    SELECT uid FROM nano_user WHERE user_role = 'Sales Coordinator' AND uid != 'jtCqpxB5FpRKDG0bvXWgEXLxNWG3' AND status = true
                    ),            
                    counted AS (
                    SELECT DISTINCT co.uid, coalesce(COUNT(nl.sales_coordinator),0) AS counter FROM coord co
                    LEFT JOIN nano_leads nl ON co.uid = nl.sales_coordinator
                    WHERE nl.created_date >= $2 AND nl.created_date <= $3
                    GROUP BY co.uid  ORDER BY co.uid 
                    ),
                    ordered AS(
                     SELECT co.uid, counter FROM coord co LEFT JOIN counted ct ON ct.uid = co.uid ORDER BY COALESCE(counter, -1) LIMIT 1
                    )               
                    UPDATE nano_leads SET sales_coordinator = (SELECT uid FROM ordered) WHERE id = $1`, [lead_id, from, to]).then((result) => {

                        return res.status(200).send({ data: lead_id, success: true })

                      }).catch((error) => {
                        console.log(error)
                        return res.status(800).send({ success: false })
                      })
                    } else {
                      return res.status(200).send({ success: true })
                    }


                  }).catch((error) => {
                    console.log(error)
                    return res.status(800).send({ success: false })
                  })


                }).catch((error) => {
                  console.log(error)
                  return res.status(800).send({ success: false })
                })

            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })
          }
          else {
            console.log(result.rowCount)
            return res.status(200).send({ success: true })
          }
        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })
    }
    else if (result.rowCount > 0) {
      console.log('Duplicate Leads')
      return res.status(200).send({ message: 'Duplicate Leads', success: false })
    }
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.post('/googlesheetinsert', async (req, res) => {
  console.log('googlesheetinsert');
  let data = req.body
  let temp = JSON.parse(data['updatedRow'])

  if (data['sheetName'] == 'Form Responses 3') {
    // if (((x || '').toString()).substring(0, 1) == '+') {
    //   return x.substring(1, x.length)
    // } else if (((x || '').toString()).substring(0, 1) == '6') {
    //   return x
    // } else if (((x || '').toString()).substring(0, 1) == '0') {
    //   return '6' + x
    // } else {
    //   return '60' + x
    // }

    let temp_sc_photo = [temp[11] ? temp[11] : null, temp[12] ? temp[12] : null, temp[13] ? temp[13] : null]
    let temp2_sc_photo = temp_sc_photo.filter(a => a != null)

    let body = {
      date: new Date(temp[0]).getTime() + '',
      customer_name: temp[1],
      customer_phone: temp[2].toString().startsWith('+') ? temp[2].substring(1, temp[2].length) : temp[2].toString().startsWith('6') ? temp[2] : temp[2].toString().startsWith('0') ? '6' + temp[2] : temp[2].toString().startsWith('1') ? '60' + temp[2] : temp[2],
      // customer_phone: temp[2],
      customer_city: temp[3],
      address: temp[4],
      customer_state: temp[5],
      customer_email: temp[7],
      issues: JSON.stringify([temp[8]]),
      sc_photo: JSON.stringify(temp2_sc_photo),
      remark: JSON.stringify([{
        remark: temp[14],
        date: new Date(temp[0]).getTime()
      }])
    }



    pool.query(`SELECT * from nano_leads where created_date = $1 AND customer_phone = $2`, [body.date, body.customer_phone]).then((result) => {
      if (result.rowCount <= 0) {

        pool.query(`INSERT INTO nano_leads(created_date, customer_name, customer_email, customer_phone, customer_city, issues, remark_json, status, label_m, label_s, customer_state, address, sc_photo, channel_id) 
        SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      WHERE NOT EXISTS (SELECT * FROM nano_leads WHERE created_date = $1) RETURNING id`,
          [body.date, body.customer_name, body.customer_email, body.customer_phone, body.customer_city, body.issues, body.remark, true, 48, 2, body.customer_state, body.address, body.sc_photo, 'Website']).then((result) => {


            if (result.rowCount > 0) {
              lead_id = result.rows[0]['id']
              !body.sales_exec ? body.sales_exec = JSON.stringify([]) : body.sales_exec
              // body.sales_exec = (!body.sales_exec || body.sales_exec == '{}' ) ? [] :  body.sales_exec
              // body.sales_exec = body.sales_exec ? body.sales_exec : []
              pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`, [body.date]).then((result) => {

                pool.query(`INSERT INTO nano_activity_log(lead_id, activity_time, activity_by, remark , activity_type) VALUES ($1, $2, $3, $4, $5)`,
                  [lead_id, body.date, null, 'Lead created by ' + (result.rows.length > 0 ? result.rows[0]['user_name'] + ' (Auto)' : 'Auto Lead'), 'Lead']).then((result) => {

                    pool.query(`INSERT INTO nano_appointment(lead_id, created_time, assigned_to4, appointment_status) VALUES($1, $2, $3, $4)`, [lead_id, body.date, body.sales_exec, true]).then((result) => {
                      let from = new Date().setHours(0, 0, 0, 0)
                      let to = new Date().setHours(23, 59, 59, 59)
                      if (body.coordinator == null) {
                        pool.query(`
                     WITH coord AS(
                      SELECT uid FROM nano_user WHERE user_role = 'Sales Coordinator' AND uid != 'jtCqpxB5FpRKDG0bvXWgEXLxNWG3' AND status = true
                      ),            
                      counted AS (
                      SELECT DISTINCT co.uid, coalesce(COUNT(nl.sales_coordinator),0) AS counter FROM coord co
                      LEFT JOIN nano_leads nl ON co.uid = nl.sales_coordinator
                      WHERE nl.created_date >= $2 AND nl.created_date <= $3
                      GROUP BY co.uid  ORDER BY co.uid 
                      ),
                      ordered AS(
                       SELECT co.uid, counter FROM coord co LEFT JOIN counted ct ON ct.uid = co.uid ORDER BY COALESCE(counter, -1) LIMIT 1
                      )               
                      UPDATE nano_leads SET sales_coordinator = (SELECT uid FROM ordered) WHERE id = $1`, [lead_id, from, to]).then((result) => {

                          // return res.status(200).send({ data: lead_id, success: true })
                          let to_id = result.rows[0]['sales_coordinator']

                          pool.query(`
                          INSERT INTO nano_sc_notification (sn_created_date, lead_id, sn_remark, uid, to_id) 
                          VALUES ($1, $2, $3, $4, $5)`, [body.date, lead_id, 'New Lead has been Created by Auto Lead', null, to_id]).then((result) => {

                            return res.status(200).send({ success: true })

                          }).catch((error) => {
                            console.log(error)
                            return res.status(800).send({ success: false })
                          })

                        }).catch((error) => {
                          console.log(error)
                          return res.status(800).send({ success: false })
                        })
                      } else {
                        return res.status(200).send({ success: true })
                      }


                    }).catch((error) => {
                      console.log(error)
                      return res.status(800).send({ success: false })
                    })


                  }).catch((error) => {
                    console.log(error)
                    return res.status(800).send({ success: false })
                  })

              }).catch((error) => {
                console.log(error)
                return res.status(800).send({ success: false })
              })
            }
            else {
              console.log(result.rowCount)
              return res.status(200).send({ success: true })
            }



          }).catch((error) => {
            console.log(error)
            return res.status(800).send({ success: false })
          })
      }
      else if (result.rowCount > 0) {
        console.log('Duplicate Leads')
        return res.status(200).send({ message: 'Duplicate Leads', success: false })
      }
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  }

  else if (data['sheetName'] == '2023 Waterproofing form (apr 11 onwards)') {
    let body = {
      date: new Date(temp[0]).getTime() + '',
      customer_name: temp[1],
      customer_email: temp[2],
      customer_phone:
        temp[3].toString().startsWith('+') ? temp[3].substring(1, temp[3].length) : temp[3].toString().startsWith('6') ? temp[3] : temp[3].toString().startsWith('0') ? '6' + temp[3] :
          temp[3].toString().startsWith('1') ? '60' + temp[3] : temp[3],
      customer_city: temp[4],
      issues: JSON.stringify([temp[5]]),
      remark: JSON.stringify([{
        remark: temp[6],
        date: new Date(temp[0]).getTime()
      }])
    }



    pool.query(`SELECT * from nano_leads where created_date = $1 AND customer_phone = $2`, [body.date, body.customer_phone]).then((result) => {
      if (result.rowCount <= 0) {
        pool.query(`INSERT INTO nano_leads(created_date, customer_name, customer_email, customer_phone, customer_city, issues, remark_json, status, label_m, label_s, channel_id) SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          WHERE NOT EXISTS (SELECT * FROM nano_leads WHERE created_date = $1) RETURNING id`,
          [body.date, body.customer_name, body.customer_email, body.customer_phone, body.customer_city, body.issues, body.remark, true, 48, 2, 'FB']).then((result) => {


            if (result.rowCount > 0) {
              lead_id = result.rows[0]['id']
              !body.sales_exec ? body.sales_exec = JSON.stringify([]) : body.sales_exec
              // body.sales_exec = (!body.sales_exec || body.sales_exec == '{}' ) ? [] :  body.sales_exec
              pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`, [body.date]).then((result) => {

                pool.query(`INSERT INTO nano_activity_log(lead_id, activity_time, activity_by, remark , activity_type) VALUES ($1, $2, $3, $4, $5)`,
                  [lead_id, body.date, null, 'Lead created by ' + (result.rows.length > 0 ? result.rows[0]['user_name'] + ' (Auto)' : 'Auto Lead'), 'Lead']).then((result) => {

                    pool.query(`INSERT INTO nano_appointment(lead_id, created_time, assigned_to4, appointment_status) VALUES($1, $2, $3, $4)`, [lead_id, body.date, body.sales_exec, true]).then((result) => {
                      let from = new Date().setHours(0, 0, 0, 0)
                      let to = new Date().setHours(23, 59, 59, 59)
                      if (body.coordinator == null) {
                        pool.query(`
                         WITH coord AS(
                          SELECT uid FROM nano_user WHERE user_role = 'Sales Coordinator' AND uid != 'jtCqpxB5FpRKDG0bvXWgEXLxNWG3' AND status = true
                          ),            
                          counted AS (
                          SELECT DISTINCT co.uid, coalesce(COUNT(nl.sales_coordinator),0) AS counter FROM coord co
                          LEFT JOIN nano_leads nl ON co.uid = nl.sales_coordinator
                          WHERE nl.created_date >= $2 AND nl.created_date <= $3
                          GROUP BY co.uid  ORDER BY co.uid 
                          ),
                          ordered AS(
                           SELECT co.uid, counter FROM coord co LEFT JOIN counted ct ON ct.uid = co.uid ORDER BY COALESCE(counter, -1) LIMIT 1
                          )               
                          UPDATE nano_leads SET sales_coordinator = (SELECT uid FROM ordered) WHERE id = $1`, [lead_id, from, to]).then((result) => {

                          // return res.status(200).send({ data: lead_id, success: true })
                          let to_id = result.rows[0]['sales_coordinator']

                          pool.query(`
                          INSERT INTO nano_sc_notification (sn_created_date, lead_id, sn_remark, uid, to_id) 
                          VALUES ($1, $2, $3, $4, $5)`, [body.date, lead_id, 'New Lead has been Created by Auto Lead', null, to_id]).then((result) => {

                            return res.status(200).send({ success: true })

                          }).catch((error) => {
                            console.log(error)
                            return res.status(800).send({ success: false })
                          })

                        }).catch((error) => {
                          console.log(error)
                          return res.status(800).send({ success: false })
                        })
                      } else {
                        return res.status(200).send({ success: true })
                      }


                    }).catch((error) => {
                      console.log(error)
                      return res.status(800).send({ success: false })
                    })


                  }).catch((error) => {
                    console.log(error)
                    return res.status(800).send({ success: false })
                  })

              }).catch((error) => {
                console.log(error)
                return res.status(800).send({ success: false })
              })
            }
            else {
              console.log(result.rowCount)
              return res.status(200).send({ success: true })
            }



          }).catch((error) => {
            console.log(error)
            return res.status(800).send({ success: false })
          })
      }
      else if (result.rowCount > 0) {
        console.log('Duplicate Leads')
        return res.status(200).send({ message: 'Duplicate Leads', success: false })
      }
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })




  }

})

app.post('/updateKiv', (req, res) => {
  console.log('updateKiv');

  pool.query(`UPDATE nano_appointment SET kiv = $1 WHERE id = $2`,
    [req.body.kiv, req.body.appointment_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false, err: error.message })
    })

})

app.post('/updateEvent', (req, res) => {
  console.log('updateEvent');

  pool.query(`UPDATE nano_check SET complete_status = $1 WHERE no = $2`,
    [req.body.complete_status, req.body.no]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false, err: error.message })
    })

})


app.post('/checkDuplicatePhone', (req, res) => {
  console.log('checkDuplicatePhone');

  pool.query(`SELECT * from nano_leads where customer_phone = $1`,
    [req.body.customer_phone]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false, err: error.message })
    })

})


//cancecl and reschedule appointment
app.post('/cancelAppointmemntBySE', (req, res) => {
  console.log('cancelAppointmemntBySE')
  // let now = new Date().getTime()

  pool.query(`WITH cancelappointment as (UPDATE nano_leads SET label_m = $1, label_s = $2 WHERE id = $3 RETURNING 1),
  updateappointment as (UPDATE nano_appointment SET appointment_status = false WHERE  id = $4)
  SELECT * FROM cancelappointment`,
    [req.body.label_m, req.body.label_s, req.body.lead_id, req.body.appointment_id]).then((result) => {
      req.body.activity_time = new Date().getTime()


      pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
        [req.body.uid]).then((result) => {

          let by = result.rows[0]['user_name']
          pool.query(`INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, 
          activity_type) VALUES ($1, $2 ,$3, $4, $5)`,
            [req.body.lead_id, req.body.activity_time, req.body.uid, 'Appointment cancel by ' + by + '(SE)\n -' + req.body.remark, 'Appointment']).then((result) => {

              return res.status(200).send({ success: true })

            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


//cancel/postpone sales by worker
app.post('/postponeSalesByWorker', (req, res) => {
  console.log('postponeSalesByWorker')
  // let now = new Date().getTime()

  pool.query(`UPDATE nano_sales SET task_status = false, subcon_state = 'Cancelled', task_postpone_remark = $2, is_postpone = $3 WHERE  id = $1`,
    [req.body.sales_id, req.body.remark, true]).then((result) => {
      req.body.activity_time = new Date().getTime()


      pool.query(`SELECT * FROM sub_user WHERE uid = $1`,
        [req.body.uid]).then((result) => {

          let by = result.rows[0]['user_name']
          pool.query(`INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, activity_type, sales_id) VALUES ($1, $2 ,$3, $4, $5, $6)`,
            [req.body.lead_id, req.body.activity_time, req.body.uid, 'Task postponed by ' + by + '(Worker)\n - ' + req.body.title, 'Subcon/Postpone', req.body.sales_id]).then((result) => {
              console.log('insert log');
              return res.status(200).send({ success: true })

            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


//get postpone remark
app.post('/getpostponeremark', (req, res) => {
  console.log('getpostponeremark')
  pool.query(`SELECT task_postpone_remark FROM nano_sales WHERE id = $1`,
    [req.body.sales_id]).then((result) => {

      return res.status(200).send({ data: result.rows[0], success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


app.post('/rescheduleAppointmemntBySE', (req, res) => {
  console.log('rescheduleAppointmemntBySE')
  // let now = new Date().getTime()

  pool.query(`WITH rescheduleAppointmemnt as (UPDATE nano_leads SET label_m = $1, label_s = $2 WHERE id = $3 RETURNING 1)
  SELECT * FROM rescheduleAppointmemnt`,
    [req.body.label_m, req.body.label_s, req.body.lead_id]).then((result) => {
      req.body.activity_time = new Date().getTime()


      pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
        [req.body.uid]).then((result) => {

          let by = result.rows[0]['user_name']
          pool.query(`INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, 
          activity_type) VALUES ($1, $2 ,$3, $4, $5)`,
            [req.body.lead_id, req.body.activity_time, req.body.uid, 'Request appointment reschdule by ' + by + '(SE)\n -' + req.body.remark, 'Appointment']).then((result) => {

              return res.status(200).send({ success: true })

            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


//insert Scaffolding Skylift
app.post('/insertScaffAndSkylift', (req, res) => {
  console.log('insertScaffAndSkylift')

  let now = new Date().getTime()

  pool.query(`With updatescaffnsky as (UPDATE nano_sales SET (scaff_height, scaff_fee, skylift_height, skylift_fee, transportation_fee) = ($1, $2, $3, $4, $5) WHERE id = $6 RETURNING id),
  updateacticitylog as (INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, 
    activity_type) VALUES ($7, $8 ,$9, $10, $11))
    SELECT * FROM updatescaffnsky`, [req.body.scaffheight, req.body.scafffee, req.body.skyliftheight, req.body.skyliftfee, req.body.transportation_fee, req.body.salesid, req.body.leadid, now, req.body.userid, 'Scaffolding and Skylift has been updated by ' + req.body.by, 'Equipment']).then((result) => {
    return res.status(200).send({ sucess: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})


app.post('/getScaffAndSkylift', (req, res) => {
  console.log('getScaffAndSkylift')
  let now = new Date().getTime()

  pool.query(`SELECT * FROM nano_sales where id = $1`, [req.body.salesid]).then((result) => {
    return res.status(200).send({ data: result.rows, sucess: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})


//upload sales order form
app.post('/uploadGenSalesOrderForm', (req, res) => {
  console.log('uploadGenSalesOrderForm')
  let quoteid = req.body.quoteid
  console.log(quoteid)
  let now = new Date().getTime()
  let now2 = new Date().getTime()

  if (quoteid) {
    pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`, [req.body.userid]).then((result) => {
      let by = result['rows'][0]['user_name']
      pool.query(`With updateform as (UPDATE nano_sales_order SET(created_date, orderform, isvoid, orderform_breakdown) = ($1, $2, false, $13) WHERE id = $4 RETURNING id),
    updateacticitylog as (INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, activity_type) VALUES ($3, $9 ,$6, $7, $8)),
    updatesalesstatus as (UPDATE nano_sales SET sales_status = $10 WHERE id = $5),
    updateleadlabel as (UPDATE nano_leads SET (label_m, label_s) = ($11, $12) WHERE id = $3),
    insertscnotification as (INSERT INTO nano_sc_notification (sn_created_date, lead_id, sn_remark, uid, to_id) 
  VALUES ($9, $3, $7, $6, (SELECT sales_coordinator FROM nano_leads WHERE id = $3)))
      SELECT * FROM updateform`, [now, req.body.latest_orderform, req.body.lead_id, quoteid, req.body.sales_id, req.body.userid, 'Sales Order Form created by ' + by,
        'Sales Order', now2, req.body.sales_status, 55, 47, req.body.breakdown_orderform]).then((result) => {
          return res.status(200).send({ success: true })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  }
  else {
    pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`, [req.body.userid]).then((result) => {
      let by = result['rows'][0]['user_name']
      pool.query(`With updateform as (INSERT INTO nano_sales_order (created_date, orderform, lead_id, appointment_id, sales_id, quotation_name, quotation_link) VALUES ($1, $2, $3, $4, $5, $10, $11) RETURNING id),
    updateacticitylog as (INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, activity_type) VALUES ($3, $9 ,$6, $7, $8)),
    updatesalesstatus as (UPDATE nano_sales SET sales_status = $12 WHERE id = $5),
    updateleadlabel as (UPDATE nano_leads SET (label_m, label_s) = ($13, $14) WHERE id = $3),
    insertscnotification as (INSERT INTO nano_sc_notification (sn_created_date, lead_id, sn_remark, uid, to_id) 
  VALUES ($9, $3, $7, $6, (SELECT sales_coordinator FROM nano_leads WHERE id = $3)))
      SELECT * FROM updateform`, [now, req.body.latest_orderform, req.body.lead_id, req.body.appointment_id, req.body.sales_id, req.body.userid, 'Sales Order Form created by ' + by,
        'Sales Order', now2, null, null, req.body.sales_status, 55, 47]).then((result) => {
          return res.status(200).send({ success: true })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  }

})



app.get('/getSOFnumber', (req, res) => {
  console.log('getSOFnumber')
  // let now = new Date().getTime()

  pool.query(`SELECT COUNT(*) as sofkey FROM nano_sales_order`).then((result) => {
    return res.status(200).send({ data: result.rows, success: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})


//event calendar
app.post('/insertevent', (req, res) => {
  console.log('insertevent')

  let now = new Date().getTime()

  pool.query(`INSERT INTO nano_event (event_title, event_desc, members, starttime, endtime, created_by, created_date, event_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [req.body.title, req.body.desc, req.body.members, req.body.starttime, req.body.endtime, req.body.created_by, req.body.created_date, req.body.status]).then((result) => {
      return res.status(200).send({ sucess: true })
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})

app.post('/updateeventnew', (req, res) => {
  console.log('updateeventnew')

  let now = new Date().getTime()

  pool.query(`UPDATE nano_event SET (event_title, event_desc, members, starttime, endtime, event_status) = ($1, $2, $3, $4, $5, $6) WHERE no = $7`,
    [req.body.title, req.body.desc, req.body.members, req.body.starttime, req.body.endtime, req.body.status, req.body.no]).then((result) => {
      return res.status(200).send({ sucess: true })
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})

app.post('/deleteevent', (req, res) => {
  console.log('deleteevent')

  let now = new Date().getTime()

  pool.query(`UPDATE nano_event SET (event_status) = ($1) WHERE no = $2`,
    [req.body.title, req.body.no]).then((result) => {
      return res.status(200).send({ sucess: true })
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})


app.get('/getAllEvent', (req, res) => {
  console.log('getAllEvent')

  let now = new Date().getTime()

  pool.query(`SELECT ne.*, nu2.user_name as created_by_name, JSON_AGG(JSON_BUILD_OBJECT('name', nu.user_name)) AS participants FROM nano_event ne 
  LEFT JOIN nano_user nu2 ON nu2.uid = ne.created_by
  LEFT JOIN nano_user nu ON nu.uid IN (SELECT * FROM JSON_ARRAY_ELEMENTS_TEXT(ne.members)) 
  GROUP BY ne.no, nu2.user_name ORDER BY ne.starttime ASC`).then((result) => {
    return res.status(200).send({ data: result.rows, sucess: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/getEventByDate', (req, res) => {
  console.log('getEventByDate')

  pool.connect((err, client, release) => {
    if (err) {
      release()
      return res.status(200).send({ success: false })
    }

    let now = new Date().getTime()

    client.query(`SELECT ne.*, nu2.user_name as created_by_name, JSON_AGG(JSON_BUILD_OBJECT('name', nu.user_name)) AS participants FROM nano_event ne 
            LEFT JOIN nano_user nu2 ON nu2.uid = ne.created_by
            LEFT JOIN nano_user nu ON nu.uid IN (SELECT * FROM JSON_ARRAY_ELEMENTS_TEXT(ne.members)) 
            WHERE starttime >= $1 AND starttime <= $2 GROUP BY ne.no, nu2.user_name ORDER BY ne.starttime ASC`, [req.body.starttime, req.body.endtime]).then((result) => {
      release()
      return res.status(200).send({ data: result.rows, sucess: true })
    }).catch((error) => {
      console.log(error)
      release()
      return res.status(800).send({ success: false })
    })

  })


})

app.post('/getEventByUid', (req, res) => {
  console.log('getEventByUid')

  let now = new Date().getTime()

  pool.query(`SELECT ne.*, nu2.user_name as created_by_name, JSON_AGG(JSON_BUILD_OBJECT('name', nu.user_name)) AS participants FROM nano_event ne 
  LEFT JOIN nano_user nu2 ON nu2.uid = ne.created_by
  LEFT JOIN nano_user nu ON nu.uid IN (SELECT * FROM JSON_ARRAY_ELEMENTS_TEXT(ne.members)) 
   WHERE EXISTS(SELECT * FROM JSON_ARRAY_ELEMENTS_TEXT(members) as ppl WHERE ppl = $1) GROUP BY ne.no, nu2.user_name ORDER BY ne.starttime ASC`, [req.body.uid]).then((result) => {
    return res.status(200).send({ data: result.rows, sucess: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/getEventByUidDate', (req, res) => {
  console.log('getEventByUidDate')

  // let today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0,0,0).getTime()

  pool.query(`SELECT ne.*, nu2.user_name as created_by_name, JSON_AGG(JSON_BUILD_OBJECT('name', nu.user_name)) AS participants FROM nano_event ne 
  LEFT JOIN nano_user nu2 ON nu2.uid = ne.created_by
  LEFT JOIN nano_user nu ON nu.uid IN (SELECT * FROM JSON_ARRAY_ELEMENTS_TEXT(ne.members)) 
  WHERE EXISTS(SELECT * FROM JSON_ARRAY_ELEMENTS_TEXT(members) as ppl WHERE ppl = $1) AND (starttime >= $2 AND starttime <= $3) GROUP BY ne.no, nu2.user_name ORDER BY ne.starttime ASC`, [req.body.uid, req.body.startdate, req.body.enddate]).then((result) => {
    return res.status(200).send({ data: result.rows, sucess: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/getEventByEventid', (req, res) => {
  console.log('getEventByEventid')

  let today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0).getTime()

  pool.query(`SELECT ne.*, nu2.user_name as created_by_name, JSON_AGG(JSON_BUILD_OBJECT('name', nu.user_name)) AS participants FROM nano_event ne 
  LEFT JOIN nano_user nu2 ON nu2.uid = ne.created_by
  LEFT JOIN nano_user nu ON nu.uid IN (SELECT * FROM JSON_ARRAY_ELEMENTS_TEXT(ne.members)) 
  WHERE ne.no = $1 GROUP BY ne.no, nu2.user_name ORDER BY ne.starttime ASC`, [req.body.no]).then((result) => {
    return res.status(200).send({ data: result.rows, sucess: true })
  }).catch((error) => {
    S
    console.log(error)
    return res.status(800).send({ success: false })
  })
})


//count meeting, notification history and reminder
app.post('/getEventstartfromtoday', (req, res) => {
  console.log('getEventstartfromtoday')

  let today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0).getTime()

  pool.query(`SELECT COUNT(*) FROM nano_event WHERE EXISTS(SELECT * FROM JSON_ARRAY_ELEMENTS_TEXT(members) as ppl WHERE ppl = $1) AND starttime >= $2`, [req.body.uid, today]).then((result) => {
    return res.status(200).send({ data: result.rows[0], sucess: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })
})

app.post('/getNotificationHistoryunread', (req, res) => {
  console.log('getNotificationHistoryunread');
  // req.body.photo = JSON.stringify([])
  pool.query(`SELECT COUNT(*) FROM nano_notification_history where to_id = $1 and his_read = false`,
    [req.body.uid]).then((result) => {

      return res.status(200).send({ data: result.rows[0], success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

//* ami
app.post('/getAppointmentForReminderCount', (req, res) => {
  console.log('getAppointmentForReminderCount')

  pool.query(`WITH selectdata as (SELECT a.id AS appointment_id, 
    (SELECT JSON_AGG(JSON_BUILD_OBJECT('date', from_date)) FROM nano_sales_package nsp WHERE nsp.sales_id = ns.id AND from_date IS NOT NULL) as install_date,
  a.assigned_to4, a.kiv,a.appointment_time,a.remark,a.checkin_latt, a.checkin_long, a.checkin AS checkin_time, a.checkin_img, a.appointment_status, 
    nls.payment_status, nls.sales_status, l.*, nu.user_name AS sc_name,
  row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number,
  row_number() over (partition by l.address ORDER BY l.created_date ASC) as address_row_number
  FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_sales nls ON nls.appointment_id = a.id LEFT JOIN nano_user nu ON l.sales_coordinator = nu.uid 
  LEFT JOIN nano_sales ns ON ns.lead_id = a.lead_id
  WHERE EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1) AND ns.subcon_state = 'Accepted')

SELECT * FROM selectdata WHERE EXISTS (SELECT * FROM JSON_ARRAY_ELEMENTS(install_date) as test
WHERE (test->>'date')::bigint >= $2 AND (test->>'date')::bigint <= $3)
ORDER BY appointment_time ASC`, [req.body.execId, req.body.startDate, req.body.endDate]).then((result) => {

    return res.status(200).send({ data: result.rowCount, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


app.post('/getAppointmentForReminderCount2', (req, res) => {
  console.log('getAppointmentForReminderCount2')

  pool.query(`WITH selectsapid AS (SELECT sales_id, from_date2 FROM nano_sales_package WHERE 
    EXISTS(SELECT 1 FROM jsonb_array_elements_text(from_date2::jsonb) AS time 
    WHERE (time::bigint >= $2::bigint AND  time::bigint <= $3::bigint)))
    SELECT a.id AS appointment_id, nsp2.from_date2,
    a.assigned_to4, a.kiv,a.appointment_time,a.remark,a.checkin_latt, a.checkin_long, a.checkin AS checkin_time, a.checkin_img, 
    a.appointment_status, nls.payment_status, nls.sales_status, l.*, nu.user_name AS sc_name,
    row_number() over (partition by l.customer_phone ORDER BY l.created_date ASC) as phone_row_number,
    row_number() over (partition by l.address ORDER BY l.created_date ASC) as address_row_number
    FROM nano_appointment a LEFT JOIN nano_leads l ON a.lead_id = l.id LEFT JOIN nano_sales nls ON nls.appointment_id = a.id LEFT JOIN nano_user nu ON l.sales_coordinator = nu.uid 
    LEFT JOIN nano_sales ns ON ns.lead_id = a.lead_id RIGHT JOIN selectsapid nsp2 ON nsp2.sales_id = ns.id
    WHERE EXISTS(SELECT * FROM json_array_elements_text(assigned_to4) as ppl where ppl = $1) AND ns.subcon_state = 'Accepted' 
  ORDER BY a.appointment_time ASC`, [req.body.execId, req.body.startDate, req.body.endDate]).then((result) => {

    return res.status(200).send({ data: result.rowCount, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/updateallstatus', (req, res) => {
  console.log('updateallstatus');
  // req.body.photo = JSON.stringify([])
  pool.query(`UPDATE nano_notification_history SET his_read = true where to_id = $1 and his_read = false`,
    [req.body.uid]).then((result) => {

      return res.status(200).send({ message: 'update done', success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updatestatus', (req, res) => {
  console.log('updatestatus');
  // req.body.photo = JSON.stringify([])
  pool.query(`UPDATE nano_notification_history SET his_read = true where to_id = $1 AND his_read = false AND his_id = $2 `,
    [req.body.uid, req.body.his_id]).then((result) => {

      return res.status(200).send({ message: 'update done', success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


app.post('/requestCustomQuotation', (req, res) => {
  console.log('requestCustomQuotation');
  // req.body.photo = JSON.stringify([])
  let now = new Date().getTime()
  pool.query(`UPDATE nano_sales SET (quotation_request, quotation_request_date, quotation_submit_date) = ($2, $3, $4) where id = $1`,
    [req.body.sales_id, true, now, null]).then((result) => {

      return res.status(200).send({ message: 'update done', success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

//query for SOF
app.post('/selectleadinfo', (req, res) => {
  console.log('selectleadinfo');
  // req.body.photo = JSON.stringify([])
  pool.query(`SELECT customer_name, customer_email, customer_phone, gender, race, address, icno, maritial_status, company_name, mailing_address, 
  residence_type, residential_status, customer_signature, conditional_status, payment_mode, termsncondition,
  mkt_inspect, mkt_install, mkt_inspect_log, mkt_install_log FROM nano_leads WHERE id = $1`,
    [req.body.leadid]).then((result) => {

      return res.status(200).send({ data: result.rows[0], success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updateleadinfo', (req, res) => {
  console.log('updateleadinfo');
  // req.body.photo = JSON.stringify([])
  pool.query(`UPDATE nano_leads SET (customer_name, customer_email, customer_phone, gender, race, address, icno, maritial_status, company_name, mailing_address, residence_type, residential_status, customer_signature, conditional_status, payment_mode, termsncondition) = 
  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) WHERE id = $17`,
    [req.body.customer_name, req.body.customer_email, req.body.customer_phone, req.body.gender, req.body.race, req.body.address, req.body.icno, req.body.maritial_status,
    req.body.company_name, req.body.mailing_address, req.body.residence_type, req.body.residential_status, req.body.customer_signature, req.body.conditional_status, req.body.payment_mode,
    req.body.termsncondition, req.body.leadid]).then((result) => {

      return res.status(200).send({ message: 'update successfully', success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


//update warranty
app.post('/updateworkingduration', (req, res) => {
  console.log('updateworkingduration');

  pool.query(`UPDATE nano_sales SET working_duration = $1 WHERE id = $2`,
    [req.body.working_duration, req.body.salesid]).then((result) => {

      return res.status(200).send({ message: 'update successfully', success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

//get the number sales have quotation
app.get('/getquotationNumber', (req, res) => {
  console.log('getquotationNumber');

  pool.query(`SELECT COUNT(id) FROM nano_sales WHERE gen_quotation::TEXT NOT LIKE '[]' AND gen_quotation IS NOT NULL`).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

//get  SOF
app.post('/getsalesorderform', (req, res) => {
  console.log('getsalesorderform');

  pool.query(`SELECT * FROM nano_sales_order WHERE lead_id = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

app.post('/updateSOFIsvoid', (req, res) => {
  console.log('updateSOFIsvoid');

  pool.query(`UPDATE nano_sales_order SET isvoid = $1 WHERE lead_id = $2`, [req.body.isvoid, req.body.id]).then((result) => {

    return res.status(200).send({ success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})



app.post('/checkexistsof', (req, res) => {
  console.log('checkexistsof');

  pool.query(`SELECT CASE WHEN COUNT(*) = 0 THEN false
  ELSE true
  END 
  FROM nano_sales_order WHERE lead_id = $1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})


//sales order form approve
app.post('/getSOFApproval', (req, res) => {
  console.log('getSOFApproval');

  pool.query(`  SELECT * FROM
  nano_sales_order WHERE appointmnet_id = $1 `, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})


app.post('/updateSOFApproval', (req, res) => {
  console.log('updateSOFApproval');
  if (req.body.role == 'ac') {

    pool.query(`UPDATE nano_sales_order SET (sof_ac_approval, sof_ac_reject, sof_sc_reject, sof_remark) = ($1,$2, $4, $5) WHERE id =  $3`,
      [req.body.sof_approval, req.body.sof_ac_reject, req.body.id, req.body.sof_sc_reject, (req.body.sof_remark || [])]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
  } else {

    pool.query(`UPDATE nano_sales_order SET (sof_sc_approval, sof_sc_reject, sof_ac_reject, sof_remark) = ($1,$2, $4, $5) WHERE id =  $3`,
      [req.body.sof_approval, req.body.sof_sc_reject, req.body.id, req.body.sof_ac_reject, (req.body.sof_remark || [])]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
  }


})

//insertinspect
app.post('/insertinspect', (req, res) => {
  console.log('insertinspect')

  let now = new Date().getTime()
  pool.query(`INSERT INTO nano_inspect (lead_id, appointment_id, inspect_photo, inspect_video, inspect_remark, created_date) VALUES ($1, $2 ,$3, $4, $5, $6)`,
    [req.body.lead_id, req.body.appointment_id, req.body.inspect_photo, req.body.inspect_video, req.body.inspect_remark, now]).then((result) => {
      req.body.activity_time = new Date().getTime()


      pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
        [req.body.uid]).then((result) => {

          let by = result.rows[0]['user_name']
          pool.query(`INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, 
          activity_type) VALUES ($1, $2 ,$3, $4, $5)`,
            [req.body.lead_id, req.body.activity_time, req.body.uid, 'Inspection Inserted By ' + by + '\n -' + req.body.remark, 'Lead']).then((result) => {

              return res.status(200).send({ success: true })

            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})

app.post('/updateinspect', (req, res) => {
  console.log('updateinspect')

  let now = new Date().getTime()
  pool.query(`UPDATE nano_leads SET(label_photo, label_video, inspect_remark, inspect_date) = ($2 ,$3, $4, $5) WHERE id = $1`,
    [req.body.lead_id, req.body.inspect_photo, req.body.inspect_video, req.body.inspect_remark, now]).then((result) => {
      req.body.activity_time = new Date().getTime()


      pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`,
        [req.body.uid]).then((result) => {

          let by = result.rows[0]['user_name']
          pool.query(`INSERT INTO nano_activity_log (lead_id, activity_time, activity_by, remark, 
          activity_type) VALUES ($1, $2 ,$3, $4, $5)`,
            [req.body.lead_id, req.body.activity_time, req.body.uid, 'Inspection Updated By ' + by + ' said : `' + req.body.inspect_remark + '`', 'Lead']).then((result) => {

              return res.status(200).send({ success: true })

            }).catch((error) => {
              console.log(error)
              return res.status(800).send({ success: false })
            })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ success: false })
        })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})



app.post('/getinspectation', (req, res) => {
  console.log('getinspectation');

  pool.query(`SELECT label_photo, label_video, inspect_date, inspect_remark FROM nano_leads WHERE id = $1`, [req.body.lead_id]).then((result) => {

    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})

//bypass
app.post('/updateBypass', async (req, res) => {
  console.log('updateBypass');

  pool.query(`UPDATE nano_appointment SET bypass = $1 WHERE id = $2`,
    [req.body.bypass, req.body.appointment_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

// final approval
app.post('/updateFinalApproval', async (req, res) => {
  console.log('updateFinalApproval');

  pool.query(`UPDATE nano_sales SET final_approval = $1 WHERE id = $2`,
    [req.body.final_approval, req.body.sales_id]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})


app.post('/updateFinalApproval2', async (req, res) => {
  console.log('updateFinalApproval2');
  let now = new Date().getTime()
  let kosong = JSON.stringify([])

  console.log(req.body.uid);

  pool.query(`WITH updatefinalappro AS (UPDATE nano_sales SET final_approval = $1, final_reject_remark = $3, final_reject_title = $9, final_reject_area = $10, status = false WHERE id = $2 RETURNING id),
  insertactivitylog as (INSERT INTO nano_activity_log (lead_id, sales_id, activity_time, activity_by, remark, activity_type) 
  VALUES ($4, $2, $5, $6, $7, $8)),
  insertscnotification as (INSERT INTO nano_sc_notification (sn_created_date, sales_id, lead_id, sn_remark, uid, to_id) 
  VALUES ($5, $2, $4, $7, $6, (SELECT sales_coordinator FROM nano_leads WHERE id = $4)))
  SELECT * FROM updatefinalappro`,
    [req.body.final_approval, req.body.sales_id, req.body.final_reject_remark, req.body.lead_id, now, req.body.uid, req.body.log,
    req.body.activity_type == 9 ? 'Installation Approval' : 'Unknown', (req.body.final_reject_title ? req.body.final_reject_title : null), (req.body.final_reject_area ? req.body.final_reject_area : kosong)]).then(async (result) => {

      if (req.body.final_approval == true) {
        try {
          const salesPackages = await pool.query(`SELECT * FROM nano_sales_package WHERE sales_id = $1`, [req.body.sales_id]);

          const promises = salesPackages.rows.map(async (row) => {
            if (row.maintain_exist) {
              const maintainDate = row.package_details.maintain_date.map(entry => {
                const newDate = new Date(now);
                newDate.setFullYear(newDate.getFullYear() + entry.year);
                newDate.setMonth(newDate.getMonth() + entry.month);
                const newTimestamp = newDate.getTime();
                return {
                  id: entry.id,
                  date: newTimestamp,
                  status: 'Pending'
                };
              });

              await pool.query(`UPDATE nano_sales_package SET maintain_confirm = $1, maintain_date = $2 WHERE sap_id = $3`, [true, JSON.stringify(maintainDate), row.sap_id]);
            }
          });

          await Promise.all(promises);
          return res.status(200).send({ success: true });

        } catch (error) {
          console.log(error);
          return res.status(500).send({ message: error.message, success: false });
        }

      } else {
        return res.status(200).send({ success: true });
      }


    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })

})

//update iswarranty
// app.post('/insertWarrantyComplaint', async (req, res) => {
//   console.log('insertWarrantyComplaint');
//   let created_date = new Date().getTime()

//   pool.query(`INSERT INTO nano_sub_warranty (created_date, lead_id, appointment_id, sales_id, warranty_photo, warranty_video, warranty_remark) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
//     [created_date, req.body.lead_id, req.body.appointment_id, req.body.sales_id, req.body.warranty_photo,req.body.warranty_video,req.body.warranty_remark]).then((result) => {

//       return res.status(200).send({ success: true })

//     }).catch((error) => {
//       console.log(error)
//       return res.status(800).send({ message: error, success: false })
//     })
// })
//insert Warranty Complaint
app.post('/insertNanoSubComplaint', async (req, res) => {
  console.log('insertNanoSubComplaint');
  let created_date = new Date().getTime()

  pool.query(`WITH updatesales AS (UPDATE nano_sales SET (status, subcon_state, is_complaint) = ($7, $8, $9) WHERE id = $4 RETURNING id), 
  insertcomplaint AS (INSERT INTO nano_sub_complaint (created_date, lead_id, appointment_id, sales_id, complaint_id, complaint_remark, complaint_image, complaint_video) VALUES ($1, $2, $3, $4, $5, $6, $10, $11))
  SELECT * FROM updatesales`,
    [created_date, req.body.lead_id, req.body.appointment_id, req.body.sales_id, req.body.complaint_id, req.body.complaint_remark, req.body.status, req.body.subcon_state,
      req.body.is_complaint, req.body.complaint_image, req.body.complaint_video]).then((result) => {

        return res.status(200).send({ success: true })

      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ message: error, success: false })
      })
})

app.post('/insertNanoSubComplaint2', async (req, res) => {
  console.log('insertNanoSubComplaint2');
  let created_date = new Date().getTime()
  pool.query(`
  SELECT user_name FROM sub_user WHERE uid = $1
`, [req.body.uid]).then((result) => {
    let by = result.rows[0]['user_name']

    pool.query(`WITH updatesales AS (UPDATE nano_sales SET (status, subcon_state, is_complaint) = ($7, $8, $9) WHERE id = $4 RETURNING id), 
  insertcomplaint AS (INSERT INTO nano_sub_complaint (created_date, lead_id, appointment_id, sales_id, complaint_id, complaint_remark, complaint_image, complaint_video) 
  VALUES ($1, $2, $3, $4, $5, $6, $10, $11)),
  insertactivitylog as (INSERT INTO nano_activity_log (lead_id, sales_id, activity_time, activity_by, remark, activity_type) 
  VALUES ($2, $3 ,$1, $12, $13, $14))
  insertscnotification as (INSERT INTO nano_sc_notification (sn_created_date, lead_id, sn_remark, uid, to_id) 
  VALUES ($1, $2, $13, $12, (SELECT sales_coordinator FROM nano_leads WHERE id = $2)))
  SELECT * FROM updatesales`,
      [created_date, req.body.lead_id, req.body.appointment_id, req.body.sales_id, req.body.complaint_id, req.body.complaint_remark, req.body.status, req.body.subcon_state,
        req.body.is_complaint, req.body.complaint_image, req.body.complaint_video, req.body.uid, req.body.log + 'by ' + by, req.body.activity_type]).then((result) => {

          return res.status(200).send({ success: true })

        }).catch((error) => {
          console.log(error)
          return res.status(800).send({ message: error, success: false })
        })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/updateNanoSubComplaint', async (req, res) => {
  console.log('updateNanoSubComplaint');

  pool.query(`UPDATE nano_sub_complaint SET (reject_remark, complaint_status) = ($2, $3) WHERE id = $1`,
    [req.body.complaint_id, req.body.reject_remark, req.body.complaint_status]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

app.post('/updateNanoSubComplaint2', async (req, res) => {
  console.log('updateNanoSubComplaint2');

  pool.query(`UPDATE nano_sub_complaint SET (complaint_remark, complaint_status, reject_remark, sub_complaint_details) = ($2, $3, $4, $5) WHERE id = $1`,
    [req.body.complaint_id, req.body.complaint_remark, req.body.complaint_status, req.body.reject_remark, req.body.sub_complaint_details]).then((result) => {

      return res.status(200).send({ success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ message: error, success: false })
    })
})

app.get('/getComplaintList', async (req, res) => {
  console.log('getComplaintList');

  pool.query(`SELECT nsc.id, nsc.complaint_id, nsc.created_date AS complaint_date, nsc.complaint_remark, nsc.complaint_status, nsc.complaint_video, nsc.complaint_image, ns.sub_team,
  nl.customer_name, nl.id AS lead_id, nl.customer_phone, nl.customer_email, nl.customer_city, nl.address as customer_address FROM nano_sub_complaint nsc LEFT JOIN nano_leads nl on nsc.lead_id = nl.id LEFT JOIN nano_sales ns on nsc.lead_id = ns.lead_id`).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.get('/getComplaintList2', async (req, res) => {
  console.log('getComplaintList2');

  pool.query(`SELECT COUNT(*) FROM nano_sub_complaint WHERE complaint_status = 'Pending Assign'`).then((result) => {

    const totalCount = result.rows[0].count;

    return res.status(200).send({ totalCount, success: true });

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/getComplaintDetail', async (req, res) => {
  console.log('getComplaintDetail');

  pool.query(`SELECT * FROM nano_sub_complaint WHERE id=$1`, [req.body.id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/getComplaintDetailByLead', async (req, res) => {
  console.log('getComplaintDetail');

  pool.query(`SELECT * FROM nano_sub_complaint WHERE lead_id = $1`, [req.body.lead_id]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ message: error, success: false })
  })
})

app.post('/updateComplaintDetailRemark', (req, res) => {
  console.log('updateComplaintDetailRemark');

  pool.query(`UPDATE nano_sub_complaint SET complaint_remark = $2 WHERE id = $1`,
    [req.body.id, req.body.complaint_remark]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})


//sc_notification
app.post('/updateScNotificationRead', (req, res) => {
  console.log('updateScNotificationRead');
  // req.body.photo = JSON.stringify([])
  pool.query(`UPDATE nano_sc_notification SET sn_read = true where sn_id = $1`,
    [req.body.id]).then((result) => {

      return res.status(200).send({ message: 'update done', success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })

})


app.post('/updateScheduleRemarkBySC', (req, res) => {
  console.log('updateScheduleRemarkBySC');

  pool.query(`UPDATE nano_schedule SET remark = $2 WHERE id = $1`,
    [req.body.schedule_id, req.body.remark]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})

//team and schedule date
app.get('/getTeam2', (req, res) => {
  console.log('getTeam2')

  let now = new Date().getTime()

  pool.query(`
  WITH selectteam as (
    SELECT DISTINCT  s.name, s.colour, s.status, s.team_id,
      (SELECT COUNT(bj3.value) FROM 
      sub_team s3, JSON_ARRAY_ELEMENTS(s3.members) bj3 WHERE s3.team_id = s.team_id) AS total,
      
      (SELECT JSONB_AGG(jsonb_build_object('user_name', user_name, 'uid', uid))
      FROM sub_user WHERE uid::text
      IN  (SELECT REPLACE(bj.value::varchar(100), '"', '') FROM sub_team s2, JSON_ARRAY_ELEMENTS(s2.members) bj 
      WHERE s2.team_id = s.team_id)) AS members
      FROM sub_team s),
      
    selectdate as (SELECT sap_id, (jsonb_array_elements_text(from_date2::jsonb)::bigint)::bigint as date, 
              ns.sub_team -> 0 ->> 'name' as teamname
        FROM nano_sales_package nsp LEFT JOIN nano_sales ns ON ns.id = nsp.sales_id 
    WHERE sub_team::text not like '[]' )
    
    SELECT s2.name, s2.colour, s2.status, s2.team_id, s2.total, s2.members,
    COALESCE(JSON_AGG(DISTINCT s.date ORDER BY s.date ASC) FILTER (WHERE s.date >= $1), '[]'::json) AS scheduled_dates
    FROM selectteam s2 
    LEFT JOIN selectdate s ON s2.name = s.teamname
    GROUP BY s2.name , s2.colour, s2.status, s2.team_id, s2.total, s2.members
    `, [now]).then((result) => {

    return res.status(200).send({ data: result.rows, success: true })
  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ error: error.message, success: false })
  })

})


app.post('/getemailByUsername', (req, res) => {
  console.log('getemailByUsername');

  pool.query(`SELECT user_email FROM sub_user WHERE login_id = $1`,
    [req.body.user_name]).then((result) => {

      return res.status(200).send({ data: result.rows, success: true })

    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ error: error.message, success: false })
    })

})



app.post('/getScNotification', (req, res) => {
  console.log('getScNotification');

  let query;
  let queryParams;

  if (req.body.role === 'Super Admin' || req.body.role === 'Admin') {
    // For Super Admin or Admin, retrieve all data without specifying uid
    query = `SELECT a.*, b.customer_name, b.customer_phone, c.id as task_id
             FROM nano_sc_notification a 
             LEFT JOIN nano_leads b ON a.lead_id = b.id 
             LEFT JOIN nano_appointment c ON c.lead_id = a.lead_id 
             ORDER BY a.sn_created_date DESC`;
    queryParams = [];
  } else {
    // For other roles, filter based on uid
    query = `SELECT a.*, b.customer_name, b.customer_phone, c.id as task_id
             FROM nano_sc_notification a 
             LEFT JOIN nano_leads b ON a.lead_id = b.id 
             LEFT JOIN nano_appointment c ON c.lead_id = a.lead_id 
             WHERE to_id = $1 
             ORDER BY a.sn_created_date DESC`;
    queryParams = [req.body.uid];
  }

  pool.query(query, queryParams)
    .then((result) => {
      return res.status(200).send({ data: result.rows, success: true });
    })
    .catch((error) => {
      console.log(error);
      return res.status(800).send({ success: false });
    });
});

app.post('/getCompletedJob', (req, res) => {
  console.log('getCompletedJob')

  pool.query(`SELECT l.*, ns.*, nu.user_name AS sc_name
              FROM nano_leads l 
              JOIN nano_appointment a ON a.lead_id = l.id 
              JOIN nano_sales ns ON ns.appointment_id = a.id 
              LEFT JOIN nano_user nu ON l.sales_coordinator = nu.uid
              WHERE EXISTS (SELECT * 
                            FROM json_array_elements_text(a.assigned_to4) AS ppl 
                            WHERE ppl = $1) 
                AND ns.subcon_state != 'Pending' AND ns.subcon_state IS NOT NULL`,
    [req.body.execId])
    .then((result) => {
      return res.status(200).send({ data: result.rows, success: true })
    })
    .catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})

app.get('/getCompletedJobAll', (req, res) => {
  console.log('getCompletedJobAll')

  pool.query(`SELECT l.*, ns.*, nu.user_name AS sc_name
              FROM nano_leads l 
              JOIN nano_appointment a ON a.lead_id = l.id 
              JOIN nano_sales ns ON ns.appointment_id = a.id 
              LEFT JOIN nano_user nu ON l.sales_coordinator = nu.uid
              WHERE EXISTS (SELECT * 
                            FROM json_array_elements_text(a.assigned_to4) AS ppl) 
                AND ns.subcon_state != 'Pending' AND ns.subcon_state IS NOT NULL`,)
    .then((result) => {
      return res.status(200).send({ data: result.rows, success: true })
    })
    .catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
})

app.post('/insertTarget', (req, res) => {
  console.log('insertTarget');

  const { target } = req.body;

  pool.query(
    `INSERT INTO nano_target (target) VALUES ($1)`,
    [target]
  ).then(() => {
    return res.status(200).send({ success: true });
  }).catch((error) => {
    console.log(error);
    return res.status(800).send({ success: false });
  });
});

app.post('/updateTarget', (req, res) => {
  console.log('updateTarget');

  const { daily, days, target, id } = req.body;

  pool.query(
    `UPDATE nano_target SET daily = $1, days = $2, target = $3 WHERE id = $4`,
    [daily, days, target, id]
  ).then(() => {
    return res.status(200).send({ success: true });
  }).catch((error) => {
    console.log(error);
    return res.status(800).send({ success: false });
  });
});

app.post('/getTargetByType', (req, res) => {
  console.log('getTargetByType');

  const { type } = req.body;

  pool.query(`SELECT * FROM nano_target WHERE type = $1`, [type])
    .then((result) => {
      return res.status(200).send({ success: true, data: result.rows[0] });
    })
    .catch((error) => {
      console.log(error);
      return res.status(800).send({ success: false });
    });
});

// Get favorites for a lead
app.post('/getGalleryFavorites', async (req, res) => {
  console.log('getGalleryFavorites');
  const { lead_id, by } = req.body;

  try {
    const result = await pool.query(
      `SELECT image FROM nano_gallery 
       WHERE lead_id = $1 AND by = $2 AND type = 'favourite'`,
      [lead_id, by]
    );

    res.status(200).send({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting favorites:', error);
    res.status(500).send({
      success: false,
      message: 'Failed to get favorites'
    });
  }
});

// Insert favorite (your existing endpoint with slight modification)
app.post('/insertGallery', async (req, res) => {
  console.log('insertGallery');
  const { image, type, by, lead_id, format } = req.body;
  const date = new Date().getTime();

  try {
    // Check if already exists
    const existing = await pool.query(
      `SELECT id FROM nano_gallery 
       WHERE image = $1 AND lead_id = $2 AND type = 'favourite'`,
      [image, lead_id]
    );

    if (existing.rows.length > 0) {
      return res.status(200).send({
        success: true,
        id: existing.rows[0].id,
        message: 'Already in favorites'
      });
    }

    // Insert new favorite
    const result = await pool.query(
      `INSERT INTO nano_gallery (image, type, by, lead_id, date_created, format)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [image, type, by, lead_id, date, format]
    );

    res.status(201).send({
      success: true,
      id: result.rows[0].id
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).send({
      success: false,
      message: 'Failed to add favorite'
    });
  }
});

// Remove favorite
app.post('/removeGalleryFavorite', async (req, res) => {
  console.log('removeGalleryFavorite');
  const { image, lead_id } = req.body;

  try {
    await pool.query(
      `DELETE FROM nano_gallery 
       WHERE image = $1 AND lead_id = $2 AND type = 'favourite'`,
      [image, lead_id]
    );

    res.status(200).send({ success: true });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).send({
      success: false,
      message: 'Failed to remove favorite'
    });
  }
});

// Remove favorite
app.post('/removeGalleryAdmin', async (req, res) => {
  console.log('removeGalleryAdmin');
  const { image } = req.body;

  try {
    await pool.query(
      `DELETE FROM nano_gallery WHERE image = $1`,
      [image]
    );

    res.status(200).send({ success: true });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).send({
      success: false,
      message: 'Failed to remove favorite'
    });
  }
});

app.post('/getGalleryByUid', (req, res) => {
  console.log('getGalleryByUid');

  const { by } = req.body;

  if (!by) {
    return res.status(400).send({
      success: false,
      message: 'User UID (by) is required'
    });
  }

  pool.query(`SELECT * FROM nano_gallery WHERE by = $1 ORDER BY date_created DESC`, [by])
    .then((result) => {
      // Initialize all four categories
      const categorizedMedia = {
        image_u: [], // Uploaded images
        image_f: [], // Favorite images
        video_u: [], // Uploaded videos
        video_f: []  // Favorite videos
      };

      // Categorize each media item
      result.rows.forEach(item => {
        if (item.format === 'image') {
          if (item.type === 'favourite') {
            categorizedMedia.image_f.push(item.image);
          } else {
            categorizedMedia.image_u.push(item.image);
          }
        } else if (item.format === 'video') {
          if (item.type === 'favourite') {
            categorizedMedia.video_f.push(item.image);
          } else {
            categorizedMedia.video_u.push(item.image);
          }
        }
      });

      return res.status(200).send({
        success: true,
        data: categorizedMedia
      });
    })
    .catch((error) => {
      console.error('Database error:', error);
      return res.status(500).send({
        success: false,
        message: 'Error fetching gallery data'
      });
    });
});

// Get workers ranked by complaint count
app.post('/getWorkersByRanking', async (req, res) => {
  console.log('getWorkersByRanking');
  
  try {
    // Get all subcon workers with their complaint counts
    const result = await pool.query(`
      SELECT 
        su.user_id,
        su.user_name,
        su.user_role,
        su.user_phone_no,
        su.user_email,
        su.profile_image,
        su.employee_id,
        su.login_id,
        su.company_id,
        COALESCE(complaint_stats.complaint_count, 0) as complaint_count,
        COALESCE(appointment_stats.appointment_count, 0) as appointment_count,
        CASE 
          WHEN COALESCE(complaint_stats.complaint_count, 0) = 0 THEN 'Best Worker'
          WHEN COALESCE(complaint_stats.complaint_count, 0) <= 2 THEN 'Good Worker'
          WHEN COALESCE(complaint_stats.complaint_count, 0) <= 5 THEN 'Average Worker'
          ELSE 'Poor Worker'
        END as ranking_category
      FROM sub_user su
      LEFT JOIN (
        SELECT 
          worker_name,
          COUNT(*) as complaint_count
        FROM (
          SELECT 
            elem->>'name' as worker_name
          FROM nano_sub_complaint nsc
          JOIN nano_sales ns ON nsc.sales_id = ns.id
          CROSS JOIN LATERAL jsonb_array_elements(ns.assigned_worker::jsonb) elem
          WHERE ns.assigned_worker IS NOT NULL 
            AND ns.assigned_worker::text != '[]'
            AND ns.assigned_worker::text != 'null'
        ) worker_complaints
        WHERE worker_name IS NOT NULL AND worker_name != ''
        GROUP BY worker_name
      ) complaint_stats ON su.user_name = complaint_stats.worker_name
      LEFT JOIN (
        SELECT 
          assigned_to as worker_id,
          COUNT(*) as appointment_count
        FROM nano_appointment 
        WHERE assigned_to IS NOT NULL 
          AND assigned_to::text != '[]' 
          AND assigned_to::text != ''
          AND assigned_to::text NOT LIKE '[%]'
        GROUP BY assigned_to
      ) appointment_stats ON su.user_id::text = appointment_stats.worker_id
      WHERE su.active = true
      ORDER BY complaint_count ASC, appointment_count DESC
    `);

    // Separate workers into categories
    const bestWorkers = result.rows.filter(worker => worker.complaint_count === 0);
    const worstWorkers = result.rows.filter(worker => worker.complaint_count > 0)
                                   .sort((a, b) => b.complaint_count - a.complaint_count);

    res.status(200).send({
      success: true,
      data: {
        best_workers: bestWorkers.slice(0, 10), // Top 10 best workers
        worst_workers: worstWorkers.slice(0, 10), // Top 10 worst workers
        all_workers: result.rows,
        summary: {
          total_workers: result.rows.length,
          best_workers_count: bestWorkers.length,
          workers_with_complaints: worstWorkers.length,
          total_complaints: result.rows.reduce((sum, worker) => sum + worker.complaint_count, 0)
        }
      }
    });
  } catch (error) {
    console.error('Error getting workers by ranking:', error);
    res.status(500).send({
      success: false,
      message: 'Failed to get workers ranking'
    });
  }
});

// Get worker performance details
app.post('/getWorkerPerformance', async (req, res) => {
  console.log('getWorkerPerformance');
  const { worker_id } = req.body;

  // Debug log for received worker_id
  console.log('Received worker_id:', worker_id, 'Type:', typeof worker_id);

  if (!worker_id) {
    return res.status(400).send({
      success: false,
      message: 'Worker ID is required'
    });
  }

  try {
    // Get worker details with performance metrics
    const result = await pool.query(`
      SELECT 
        su.user_id,
        su.user_name,
        su.user_role,
        su.user_phone_no,
        su.user_email,
        su.profile_image,
        su.employee_id,
        su.login_id,
        su.company_id,
        COALESCE(complaint_stats.complaint_count, 0) as complaint_count,
        COALESCE(appointment_stats.appointment_count, 0) as appointment_count,
        COALESCE(completed_stats.completed_count, 0) as completed_count,
        CASE 
          WHEN COALESCE(complaint_stats.complaint_count, 0) = 0 THEN 'Best Worker'
          WHEN COALESCE(complaint_stats.complaint_count, 0) <= 2 THEN 'Good Worker'
          WHEN COALESCE(complaint_stats.complaint_count, 0) <= 5 THEN 'Average Worker'
          ELSE 'Poor Worker'
        END as ranking_category,
        CASE 
          WHEN COALESCE(appointment_stats.appointment_count, 0) > 0 
          THEN ROUND((COALESCE(completed_stats.completed_count, 0)::numeric / COALESCE(appointment_stats.appointment_count, 0)::numeric) * 100::numeric, 2)::numeric
          ELSE 0
        END as completion_rate
      FROM sub_user su
      LEFT JOIN (
        SELECT 
          worker_name,
          COUNT(*) as complaint_count
        FROM (
          SELECT 
            elem->>'name' as worker_name
          FROM nano_sub_complaint nsc
          JOIN nano_sales ns ON nsc.sales_id = ns.id
          CROSS JOIN LATERAL jsonb_array_elements(ns.assigned_worker::jsonb) elem
          WHERE ns.assigned_worker IS NOT NULL 
            AND ns.assigned_worker::text != '[]'
            AND ns.assigned_worker::text != 'null'
        ) worker_complaints
        WHERE worker_name IS NOT NULL AND worker_name != ''
        GROUP BY worker_name
      ) complaint_stats ON su.user_name = complaint_stats.worker_name
      LEFT JOIN (
        SELECT 
          assigned_to as worker_id,
          COUNT(*) as appointment_count
        FROM nano_appointment 
        WHERE assigned_to IS NOT NULL 
          AND assigned_to::text != '[]' 
          AND assigned_to::text != ''
          AND assigned_to::text NOT LIKE '[%]'
        GROUP BY assigned_to
      ) appointment_stats ON su.user_id::text = appointment_stats.worker_id
      LEFT JOIN (
        SELECT 
          assigned_to as worker_id,
          COUNT(*) as completed_count
        FROM nano_appointment 
        WHERE assigned_to IS NOT NULL 
          AND assigned_to::text != '[]' 
          AND assigned_to::text != ''
          AND assigned_to::text NOT LIKE '[%]'
          AND appointment_status = true
        GROUP BY assigned_to
      ) completed_stats ON su.user_id::text = completed_stats.worker_id
      WHERE su.user_id = $1
    `, [worker_id]);

    // Debug log for query result
    console.log('Worker query result rows:', result.rows.length);
    console.log('Worker query result:', result.rows);

    if (result.rows.length === 0) {
      return res.status(404).send({
        success: false,
        message: 'Worker not found'
      });
    }

    const worker = result.rows[0];

    // Get recent complaints for this worker
    const complaintsResult = await pool.query(`
      SELECT 
        nsc.id,
        nsc.created_date,
        nsc.complaint_remark,
        nsc.complaint_status,
        nsc.complaint_image,
        nsc.complaint_video,
        nsc.sub_complaint_details
      FROM nano_sub_complaint nsc
      JOIN nano_sales ns ON nsc.sales_id = ns.id
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(ns.assigned_worker::jsonb) elem
        WHERE elem->>'name' = $1
          AND ns.assigned_worker IS NOT NULL 
          AND ns.assigned_worker::text != '[]'
          AND ns.assigned_worker::text != 'null'
      )
      ORDER BY nsc.created_date DESC
      LIMIT 10
    `, [worker.user_name]);

    // Get recent appointments for this worker
    const appointmentsResult = await pool.query(`
      SELECT 
        na.id,
        na.appointment_time,
        na.appointment_status,
        na.checkin,
        na.checkin_address,
        na.remark,
        nl.customer_name,
        nl.customer_phone
      FROM nano_appointment na
      JOIN nano_leads nl ON na.lead_id = nl.id
      WHERE na.assigned_to = $1
        AND na.assigned_to IS NOT NULL 
        AND na.assigned_to::text != '[]' 
        AND na.assigned_to::text != ''
        AND na.assigned_to::text NOT LIKE '[%]'
      ORDER BY na.appointment_time DESC
      LIMIT 10
    `, [worker_id.toString()]);

    res.status(200).send({
      success: true,
      data: {
        worker: worker,
        recent_complaints: complaintsResult.rows,
        recent_appointments: appointmentsResult.rows
      }
    });
  } catch (error) {
    console.error('Error getting worker performance:', error);
    res.status(500).send({
      success: false,
      message: 'Failed to get worker performance'
    });
  }
});


// Use environment variable for port, with fallbacks
const PORT = process.env.PORT || (isProduction ? 443 : 3000);
server.listen(PORT, function () {
  console.log(`Server started on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  if (isDevelopment) {
    console.log(`Local development URL: http://localhost:${PORT}`);
  } else {
    console.log(`Production server running on port ${PORT}`);
  }
});

