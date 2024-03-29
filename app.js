const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const app = express()
app.use(express.json())

let db = null
//initializiDbServer
const initializiDbServer = async () => {
  try {
    db = await open({filename: dbPath, driver: sqlite3.Database})
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error:${e.message}`)
    process.exit(1)
  }
}
initializiDbServer()

//convert to Response Object
const convertResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}
// authenticationToken

const authenticationToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        //request.username = payload.username
        next()
      }
    })
  }
}

//API-2
// get all State
app.get('/states', async (request, response) => {
  //console.log('Get State  APIs')
  // verifying jwtToken
  const selectDistrictQuery = `SELECT * FROM state;`
  const distrctData = await db.all(selectDistrictQuery)
  response.send(distrctData.map(convertResponseObject))
})
// Register user Id
app.post('/user/', async (request, response) => {
  const {username, name, password, gender, location} = request.body
  const hasshedPassword = await bcrypt.hash(password, 10)
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    // adding new user details
    const createUserQuery = `INSERT INTO user(username, name, password, gender, location)
    VALUES (
      ?,?,?,?,?
    );`
    await db.run(createUserQuery, [
      username,
      name,
      hasshedPassword,
      gender,
      location,
    ])
    response.send('User Created Successfully')
  } else {
    response.status(400)
    response.send('User already exits')
  }
})

//LOGIN USER DETAILS THROUGH USERNAME AND PASSWORD
app.post('/login', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400).send('Invalid User')
  } else {
    const ispasswordMatch = await bcrypt.compare(password, dbUser.password)
    if (ispasswordMatch === true) {
      //response.send('Login Success!')
      // Generating jwts Token
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//GET Method APIs -3
//Returns a state based on the state ID
app.get('/states/:stateId/', authenticationToken, async (request, response) => {
  const {stateId} = request.params
  const getSelectQuery = `SELECT * FROM state WHERE state_id =?;`
  const getDataById = await db.get(getSelectQuery, [stateId])
  response.send(convertResponseObject(getDataById))
})

//post APIS-4
//convertDistricToResponseObject
const convertDistrictResponseObject = dbObject => {
  return {
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}
// Post Create an districti in district table
app.post('/districts', authenticationToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postDetailsQuery = `
  INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
  VALUES (
    ?,?,?,?,?,?
  );
  `
  const dbResponse = await db.run(postDetailsQuery, [
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  ])

  response.send('District Successfully Added')
})

//API-5 GET Returns a district based on the district ID
const convertDBResponseObject1 = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

app.get(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const getdistrictByIdQuery = `
  SELECT * FROM district WHERE district_id= ?;
  `
    const getDistrictId = await db.get(getdistrictByIdQuery, [districtId])
    response.send(convertDBResponseObject1(getDistrictId))
  }
)

// API-6 DELETE
//Deletes a district from the district table based on the district ID

app.delete(
  '/districts/:districtId',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQuery = `
  DELETE FROM district WHERE district_id = ?;
  `
    const deleteUpdate = await db.run(deleteQuery, [districtId])
    const updateQuery = convertResponseObject(deleteUpdate)
    response.send('District Removed')
  }
)

//API-7 PUT
//Updates the details of a specific district based on the district ID
app.put(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body

    const updateQuery = `
    UPDATE district
    SET (
      district_name = ?, 
      state_id = ?, 
      cases = ?, 
      cured = ?, 
      active = ?, 
      deaths = ? )
    WHERE district_id=?;
  `
    await db.run(updateQuery, [
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
      districtId,
    ])
    //const convertedDistrict = specificDistrict(getUpdatedId)
    response.send('District Details Updated')
  }
)

//API-8 get
//Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID
const statisticsOfTatolCases = dbObject => {
  return {
    totalCases: dbObject.total_cases,
    totalCured: dbObject.total_cured,
    totalActive: dbObject.total_active,
    totalDeaths: dbObject.total_deaths,
  }
}
app.get(
  '/states/:stateId/stats/',
  authenticationToken,
  async (request, response) => {
    const {stateId} = request.params
    const sumOfTotalQuery = `
  SELECT 
    SUM(cases) as total_cases,
    SUM(cured) as total_cured,
    SUM(active) as total_active,
    SUM(deaths) as total_deaths
  FROM 
    district 
  WHERE 
    state_id =?
  `
    const getsumData = await db.get(sumOfTotalQuery, [stateId])
    response.send(statisticsOfTatolCases(getsumData))
  }
)

module.exports = app
