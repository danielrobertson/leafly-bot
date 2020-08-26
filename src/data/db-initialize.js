const { Client } = require("pg");

const leaflyDb = new Client({
  user: process.env.LEAFLY_DB_USER,
  host: process.env.LEAFLY_DB_HOST,
  database: "leafly",
  password: process.env.LEAFLY_DB_PW,
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

const reservationsDb = new Client({
  user: process.env.LEAFLY_RESERVATIONS_DB_USER,
  host: process.env.LEAFLY_RESERVATIONS_DB_HOST,
  database: "reservations",
  password: process.env.LEAFLY_RESERVATIONS_DB_PW,
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

try {
  leaflyDb.connect();
  reservationsDb.connect();
  console.log("databases connected");
} catch (e) {
  console.error(e);
}

module.exports = {
  leaflyDb,
  reservationsDb,
};
