app.post('/getAppointmentList', (req, res) => {
    console.log('getAppointmentList')
    pool.query(`SELECT a.id AS appointment_id,a.kiv,a.appointment_time, a.checkin AS checkin_time, a.checkin_img, a.appointment_status, 
    l.*, nls.payment_status, nls.sales_status,
     (SELECT JSON_AGG(JSON_BUILD_OBJECT('assigned_to', b.user_name, 'colour', b.colour)) FROM nano_appointment jna LEFT JOIN nano_user b 
    ON b.uid = ANY(SELECT json_array_elements_text(jna.assigned_to))
      WHERE jna.id = a.id) as assigned_to_list, 
      nu2.user_name AS sales_coordinator,
      (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('check_lat', nc.check_lat, 'check_long', nc.check_long, 'check_time', 
                                           nc.check_time, 'check_img', nc.check_img, 
                                          'check_address', nc.check_address, 'check_remark', nc.checK_remark,
                                           'check-status', nc.check_status, 
                                           'event_time', nc.event_time, 'complete_status', nc.complete_status)) 
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


  app.post('/getLeadDetail', (req, res) => {
  console.log('getLeadDetail');

  pool.query(`    SELECT (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = 
  (SELECT id FROM nano_sales WHERE appointment_id = 
   (SELECT id FROM nano_appointment WHERE lead_id = $1 ORDER BY id ASC limit 1) )) 
   AS total_price, nls.sales_status, nl.sc_photo AS sc_photo, nls.assigned_worker, nls.subcon_choice, nls.finance_check, nls.finance_remark,
  nl.id AS lead_id,  nla.name AS label_m, nla.colour AS label_m_colour,nla2.name
  AS label_s, nla2.colour AS label_s_colour, nap.checkin 
  AS checkin_time, nap.checkin_img, nap.checkin_address, nap.appointment_status, nl.gender, nl.race, nl.warranty_id, 
    nap.appointment_time, nap.kiv,  
	(SELECT JSON_AGG(JSON_BUILD_OBJECT('assigned_to', b.user_name, 'colour', b.colour)) FROM nano_appointment jna LEFT JOIN nano_user b 
ON b.uid = ANY(SELECT json_array_elements_text(jna.assigned_to))
  WHERE jna.id = nap.id) as assigned_to_list, nl.created_date, nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, 
	nl.customer_state, nls.subcon_state,
    nl.address, nl.customer_unit, nl.customer_title, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues,
	nl.status, nl.lattitude, nl.longtitude, nl.ads_id AS ads, nl.channel_id AS channel, nls.id  AS sales_id, nls.status AS whole_status,
    nls.payment_status , nap.id AS appointment_id,nl.remark_json, nu1.user_name AS sales_admin, 
	nu3.user_name AS sales_coordinator,
	(SELECT JSONB_AGG(JSONB_BUILD_OBJECT('check_lat', nc.check_lat, 'check_long', nc.check_long, 'check_time', 
										 nc.check_time, 'check_img', nc.check_img, 
									  'check_address', nc.check_address, 'check_remark', nc.checK_remark, 'check-status', nc.check_status, 
									   'event_time', nc.event_time, 'complete_status', nc.complete_status)) FROM nano_check nc 
	 WHERE nap.id = nc.appointment_id AND nc.status = true) as check_details
    FROM nano_leads nl LEFT JOIN nano_user nu1 ON nl.created_by = nu1.uid 
	LEFT JOIN nano_user nu3 ON nl.sales_coordinator = nu3.uid LEFT JOIN nano_appointment nap 
    ON nap.lead_id = nl.id LEFT JOIN nano_label nla ON nl.label_m = nla.id 
	LEFT JOIN nano_label nla2 
    ON nl.label_s = nla2.id LEFT JOIN nano_sales nls ON nap.id = nls.appointment_id  
    WHERE nl.id = $1`, [req.body.lead_id]).then((result) => {
    return res.status(200).send({ data: result.rows[0], success: true })

  }).catch((error) => {
    console.log(error)
    return res.status(800).send({ success: false })
  })

})



app.post('/updateLeadAppointment', (req, res) => {
    console.log('updateLeadAppointment');
    console.log(req.body);
  
    pool.query('SELECT id from nano_appointment WHERE lead_id = $1', [req.body.id]).then((checker) => {
      console.log(checker)
      let created = new Date().getTime()
  
      if (checker.rows.length < 1) {
        pool.query(`INSERT INTO nano_appointment(lead_id, created_time, assigned_to, appointment_status) VALUES($1, $2, $3, $4)`, [req.body.id, created, req.body.assigned_to, true]).then((result) => {
  
          pool.query(`UPDATE nano_leads SET (address,lattitude, longtitude, remark,saleexec_note, sales_exec, customer_unit) = ($1, $2, $3, $4, $5, $6, $8) WHERE id = $7 `
            , [req.body.address, req.body.lattitude, req.body.longtitude, req.body.remark, req.body.sales_exec_note, req.body.sales_exec, req.body.id, req.body.customer_unit]).then((result) => {
  
              pool.query(`UPDATE nano_appointment SET (appointment_status, remark, assigned_to, appointment_time,sales_exec_note) = ($1, $2, $3, $4, $5) 
              WHERE lead_id = $6 RETURNING id `
                , [req.body.status, req.body.remark, req.body.assigned_to, req.body.appointment_time, req.body.sales_exec_note, req.body.id]).then((result) => {
                  console.log(result)
                  req.body.appointment_id = result.rows[0]['aid']
  
                  pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`
                    , [req.body.uid]).then((result) => {
                      req.body.activity_time = new Date().getTime()
                      console.log(result.rows[0]['user_name']);
                      console.log(result.rows.length > 0 ? result.rows[0]['user_name'] : null);
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
  
            pool.query(`UPDATE nano_appointment SET (appointment_status, remark, assigned_to, appointment_time,sales_exec_note, kiv = ($1, $2, $3, $4, $5, $6) WHERE lead_id = $7 RETURNING id `
              , [req.body.status, req.body.remark, req.body.assigned_to, req.body.appointment_time, req.body.sales_exec_note, req.body.kiv, req.body.id]).then((result) => {
                console.log(result)
                req.body.appointment_id = result.rows[0]['aid']
                let created = new Date().getTime()
                pool.query(`SELECT user_name FROM nano_user WHERE uid = $1`
                  , [req.body.uid]).then((result) => {
                    req.body.activity_time = new Date().getTime()
                    console.log(result.rows[0]['user_name']);
                    console.log(result.rows.length > 0 ? result.rows[0]['user_name'] : null);
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


  app.post('/getLeadList2', async (req, res) => {
    console.log('getLeadList2')
    pool.query(`WITH selected AS (
        SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
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
            nls.total AS payment_total, nls.sales_status, nat.assigned_to as sales_exec, nat.checkin,
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
            (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
            nls.subcon_state, nls.finance_check, nls.finance_remark, 
            (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
            nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
            FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
            LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
            nano_sales nls ON nat.id = nls.appointment_id WHERE exists(select * from json_array_elements_text(nat.assigned_to) as ppl where ppl = $1 )
          ) SELECT * FROM selected WHERE (phone_row_number = 1 OR phone_row_number = 0) OR warranty_id IS NOT NULL OR verified = true`, [req.body.uid]
    ).then((result) => {
      return res.status(200).send({ data: result.rows, success: true })
  
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  })


  
app.post('/getPendingAppointment', async (req, res) => {
    console.log('getPendingAppointment')
    let role = req.body.user_role
    if (role == 'Super Admin' || role == 'System Admin') {
      pool.query(`WITH selected AS (
        SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
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
            nls.total AS payment_total, nls.sales_status, nat.assigned_to, nat.checkin,
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
            (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
            nls.subcon_state, nls.finance_check, nls.finance_remark, 
            (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
            nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
            FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
            LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
            nano_sales nls ON nat.id = nls.appointment_id 
          ) SELECT * FROM selected WHERE( label_s = 'Pending Appointment Date' OR  label_s = 'Appointment Cancelled' OR label_s = 'Appointment Reschedule') AND (((phone_row_number = 1 OR phone_row_number = 0) OR verified = true) AND warranty_id IS NULL)`
      ).then((result) => {
        return res.status(200).send({ data: result.rows, success: true })
  
      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }
    else if (role == 'Sales Coordinator') {
      pool.query(`WITH selected AS (
        SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, 
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
            nls.total AS payment_total, nls.sales_status, nat.assigned_to,  nat.checkin,
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
            (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
            nls.subcon_state, nls.finance_check, nls.finance_remark, 
            (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
            nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
            FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
            LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN
            nano_sales nls ON nat.id = nls.appointment_id WHERE u3.uid = $1
          ) SELECT * FROM selected WHERE ( label_s = 'Pending Appointment Date' OR  label_s = 'Appointment Cancelled' OR label_s = 'Appointment Reschedule') AND (((phone_row_number = 1 OR phone_row_number = 0) OR verified = true) AND warranty_id IS NULL)`, [req.body.user_uid]
      ).then((result) => {
        return res.status(200).send({ data: result.rows, success: true })
  
      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }
    else if (role == 'Sales Executive') {
      pool.query(`WITH selected AS (
        SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, 
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
            nls.total AS payment_total, nls.sales_status, nat.assigned_to, nat.checkin,
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
            (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
            nls.subcon_state, nls.finance_check, nls.finance_remark, 
            (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
            nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
            FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
            LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN
            nano_sales nls ON nat.id = nls.appointment_id WHERE exists(select * from json_array_elements_text(nat.assigned_to) as ppl where ppl = $1 )
          ) SELECT * FROM selected WHERE ( label_s = 'Pending Appointment Date' OR  label_s = 'Appointment Cancelled' OR label_s = 'Appointment Reschedule') AND (((phone_row_number = 1 OR phone_row_number = 0) OR verified = true) AND warranty_id IS NULL)`, [req.body.user_uid]
      ).then((result) => {
        return res.status(200).send({ data: result.rows, success: true })
  
      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }
    else {
      pool.query(`WITH selected AS (
        SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, 
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
            nls.total AS payment_total, nls.sales_status, nat.assigned_to, nat.checkin,
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
            (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
            nls.subcon_state, nls.finance_check, nls.finance_remark, 
            (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
            nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
            FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
            LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN
            nano_sales nls ON nat.id = nls.appointment_id
          ) SELECT * FROM selected WHERE (label_s = 'Pending Appointment Date' OR  label_s = 'Appointment Cancelled' OR label_s = 'Appointment Reschedule') AND (((phone_row_number = 1 OR phone_row_number = 0) OR verified = true) AND warranty_id IS NULL)`
      ).then((result) => {
        return res.status(200).send({ data: result.rows, success: true })
  
      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }
  })


  app.post('/getWarrantyList', async (req, res) => {
    console.log('getWarrantyList')
    let role = req.body.user_role
    if (role == 'Super Admin' || role == 'System Admin') {
      pool.query(`WITH selected AS (
        SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
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
            nls.total AS payment_total, nls.sales_status, nat.assigned_to, nat.checkin,
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
        SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, 
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
            nls.total AS payment_total, nls.sales_status, nat.assigned_to, nat.checkin,
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
        SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, 
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
            nls.total AS payment_total, nls.sales_status, nat.assigned_to, nat.checkin,
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
            (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
            nls.subcon_state, nls.finance_check, nls.finance_remark, 
            (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
            nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
            FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
            LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN
            nano_sales nls ON nat.id = nls.appointment_id WHERE nla2.name = 'Pending Appointment Date' AND exists(select * from json_array_elements_text(nat.assigned_to) as ppl where ppl = $1 )
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
        SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, 
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
            nls.total AS payment_total, nls.sales_status, nat.assigned_to, nat.checkin,
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
            (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
            nls.subcon_state, nls.finance_check, nls.finance_remark, 
            (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
            nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
            FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
            LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
            nano_sales nls ON nat.id = nls.appointment_id WHERE u3.uid = $1 
          ) SELECT * FROM selected WHERE ((phone_row_number = 1 OR phone_row_number = 0) OR warranty_id IS NOT NULL OR verified = true) AND ((created_date::bigint) > $2 AND (created_date::bigint) < $3) `, [req.body.user_uid, req.body.startDate, req.body.endDate]
      ).then((result) => {
        return res.status(200).send({ data: result.rows, success: true })
  
      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }
    else if (role == 'Sales Executive') {
      pool.query(`WITH selected AS (
        SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, 
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
            nls.total AS payment_total, nls.sales_status, nat.assigned_to, nat.checkin,
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id) AS total_paid, 
            (SELECT id FROM nano_sales WHERE id = nls.id AND total = 
            (SELECT SUM(total) FROM nano_payment_log WHERE sales_id = nls.id AND ac_approval = 'Approved' AND sc_approval = 'Approved')) AS approved_paid, 
            nls.subcon_state, nls.finance_check, nls.finance_remark, 
            (SELECT category FROM nano_channel WHERE name = nl.channel_id) AS category,
            nl.lattitude, nl.longtitude, u1.user_name AS created_by, u3.user_name AS sales_coord, u3.uid AS sales_coord_uid
            FROM nano_leads nl LEFT JOIN nano_appointment nat ON nl.id = nat.lead_id LEFT JOIN nano_user u1 ON nl.created_by = u1.uid LEFT JOIN nano_user u3 ON nl.sales_coordinator = u3.uid
            LEFT JOIN nano_label nla ON nl.label_m = nla.id LEFT JOIN nano_label nla2 ON nl.label_s = nla2.id LEFT JOIN 
            nano_sales nls ON nat.id = nls.appointment_id WHERE exists(select * from json_array_elements_text(nat.assigned_to) as ppl where ppl = $1 )
          ) SELECT * FROM selected WHERE( (phone_row_number = 1 OR phone_row_number = 0) OR warranty_id IS NOT NULL OR verified = true)  AND ((created_date::bigint) > $2 AND (created_date::bigint) < $3)`, [req.body.user_uid, req.body.startDate, req.body.endDate]
      ).then((result) => {
        return res.status(200).send({ data: result.rows, success: true })
  
      }).catch((error) => {
        console.log(error)
        return res.status(800).send({ success: false })
      })
    }
    else {
      return res.status(200).send({ data: 'no this role', success: false })
    }
  })


  app.post('/getDuplicateList', async (req, res) => {
    console.log('getDuplicateList')
    pool.query(`SELECT lead_id, customer_title, label_m, label_m_colour, label_s, label_s_colour, warranty_id, created_date, customer_name, customer_email, customer_phone, customer_city, customer_state, verified,
    address, company_address, saleexec_note, remark, services, issues::JSONB, lead_status, ads_id, channel_id, payment_status, payment_total, sales_status, assigned_to, checkin, total_paid,
     approved_paid, subcon_state, finance_check, finance_remark, category, lattitude, longtitude, created_by, sales_coord, sales_coord_uid
    FROM (
      SELECT nl.id AS lead_id, nl.customer_title, nla.name AS label_m, nla.colour AS label_m_colour, nla2.name AS label_s, nla2.colour AS label_s_colour, nl.warranty_id,
      (SELECT CASE WHEN (SELECT id FROM nano_leads WHERE created_date LIKE '%-%' AND id = nl.id) IS NOT NULL THEN 
      (SELECT EXTRACT(epoch from created_date::date) * 1000 FROM nano_leads WHERE id = nl.id)
      ELSE nl.created_date::bigint end) AS created_date,
      row_number() over (partition by nl.customer_phone ORDER BY nl.created_date ASC) as phone_row_number,
      row_number() over (partition by nl.address ORDER BY nl.created_date ASC) as address_row_number,
      nl.customer_name, nl.customer_email, nl.customer_phone, nl.customer_city, nl.customer_state, nl.verified,
      nl.address, nl.company_address, nl.saleexec_note, nl.remark, nl.services, nl.issues, nl.status AS lead_status, nl.ads_id, nl.channel_id,nat.kiv, nat.appointment_status, nls.payment_status,
       nls.total AS payment_total, nls.sales_status, nat.assigned_to, nat.checkin,
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
    WHERE phone_row_number > 1 AND verified IS NULL AND warranty_id IS NULL AND created_date > $1 AND created_date < $2
    GROUP BY lead_id, customer_title, label_m, label_m_colour, label_s, label_s_colour, warranty_id, created_date, customer_name, customer_email, customer_phone, customer_city, customer_state, verified,
    address, company_address, saleexec_note, remark, services, issues::JSONB, lead_status, ads_id, channel_id, payment_status, payment_total, sales_status, assigned_to, checkin, total_paid, approved_paid,
     subcon_state, finance_check, finance_remark, category, lattitude, longtitude, created_by, sales_coord, sales_coord_uid`, [req.body.startDate, req.body.endDate]
    ).then((result) => {
      return res.status(200).send({ data: result.rows, success: true })
  
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  })



  app.post('/getAllScheduleByUid', (req, res) => {
    console.log('getAllScheduleByUid');
  
    pool.query(`SELECT nsl.* FROM nano_schedule nsl LEFT JOIN nano_sales ns ON nsl.sales_id = ns.id 
    LEFT JOIN nano_appointment na ON ns.appointment_id = na.id WHERE exists(select * from json_array_elements_text(na.assigned_to) as ppl where ppl = $1 ) ORDER BY schedule_date DESC`, [req.body.uid]).then((result) => {
  
      return res.status(200).send({ data: result.rows, success: true })
  
    }).catch((error) => {
      console.log(error)
      return res.status(800).send({ success: false })
    })
  
  })



  app.post('/getEventList', (req, res) => {
    console.log('getEventList')
  
    pool.query(`SELECT nc.*, a.id AS appointment_id,a.kiv,a.appointment_time, a.checkin AS checkin_time, a.checkin_img, a.lead_id as lead_id, l.*, nls.payment_status, nls.sales_status,
    (SELECT JSON_AGG(JSON_BUILD_OBJECT('assigned_to', b.user_name, 'colour', b.colour)) FROM nano_appointment jna LEFT JOIN nano_user b 
ON b.uid = ANY(SELECT json_array_elements_text(jna.assigned_to))
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



  
  

