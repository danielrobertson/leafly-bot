require("dotenv").config();
const { leaflyDb, reservationsDb } = require("./db-initialize");

const fetchLatestReservationByUser = async (userId) => {
  try {
    const res = await reservationsDb.query(
      "select id, dispensary_name, dispensary_logo_url, status from reservations where user_id = $1 order by created_at desc limit 1",
      [userId]
    );
    console.log(res.rows[0]);
    return res.rows[0];
  } catch (err) {
    console.log(err.stack);
  }
};

const fetchUserByPhone = async (phone) => {
  try {
    const res = await leaflyDb.query(
      'select id from "user" where phone_number = $1',
      [phone]
    );
    console.log(res.rows[0]);
    return res.rows[0];
  } catch (err) {
    console.log(err.stack);
  }
};

const fetchUserByEmail = async (email) => {
  try {
    const res = await leaflyDb.query('select id from "user" where email = $1', [
      email,
    ]);
    console.log(res.rows[0]);
    return res.rows[0];
  } catch (err) {
    console.log(err.stack);
  }
};

// fetchUserByPhone("5127334907");

// fetchLatestReservationById(3359);

module.exports = {
  fetchLatestReservationByUser,
  fetchUserByPhone,
  fetchUserByEmail,
};
