const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3005, () => {
      console.log("Server Running at http://localhost:3005/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

// authentication token

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token'");
      } else {
        next();
      }
    });
  }
};

//user login

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//api1

app.get("/states/", authenticateToken, async (request, response) => {
  const stateListQuery = `
    SELECT state_id AS stateId, state_name AS stateName, population FROM state;`;
  const dbResponse = await db.all(stateListQuery);
  response.send(dbResponse);
});

//api2

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateListQuery = `
    SELECT state_id AS stateId, state_name AS stateName, 
    population FROM state
    WHERE stateId = ${stateId};`;
  const dbResponse = await db.get(getStateListQuery);
  response.send(dbResponse);
});

//api3

app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
    INSERT INTO
      district (district_name, state_id, cases, cured, active, deaths)
    VALUES
      (
        '${districtName}',
         ${stateId},
         ${cases},
         ${cured},
         ${active},
         ${deaths}
      );`;
  const dbResponse = await db.run(addDistrictQuery);
  const district_id = dbResponse.lastID;
  response.send("District Successfully Added");
});

//api4

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictListQuery = `
    SELECT district_id districtId,
  district_name AS districtName,
  state_id AS stateId,
  cases,
  cured,
  active,
  deaths FROM district
    WHERE districtId = ${districtId};`;
    const dbResponse = await db.get(getDistrictListQuery);
    response.send(dbResponse);
  }
);

//api5

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district
    WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//api6

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictDetailsQuery = `
    UPDATE 
    district
    SET 
    district_name = '${districtName}',state_id = ${stateId},
    cases = ${cases},cured = ${cured},active = ${active},deaths = ${deaths}
    WHERE district_id = ${districtId}`;
    await db.run(updateDistrictDetailsQuery);
    response.send("District Details Updated");
  }
);

//api7

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statusListQuery = `
    SELECT
     SUM(cases) AS totalCases,
  SUM(cured) AS totalCured,
  SUM(active) AS totalActive,
  SUM(deaths) AS totalDeaths FROM district
    WHERE state_id = ${stateId};`;
    const dbResponse = await db.get(statusListQuery);
    response.send(dbResponse);
  }
);

//api8

// app.get("/districts/:districtId/details/", async (request, response) => {
//   const { districtId } = request.params;
//   const getStateIdQuery = `
//     SELECT
//      state_id FROM district
//     WHERE district_id = ${districtId};`;
//   const dbStateIdResponse = await db.get(getStateIdQuery);
//   const getStateNameQuery = `
// SELECT state_name AS stateName FROM state
// WHERE state_id = ${dbStateIdResponse.state_id}`;

//   const dbResponse = await db.get(getStateNameQuery);

//   response.send(dbResponse);
// });

initializeDBAndServer();

module.exports = app;
