
require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const fitnessRoutes = require('./routes/fitness')
const workoutRoutes = require('./routes/workouts')
const nutritionRoutes = require("./routes/nutrition");
const sleepRoutes = require('./routes/sleep')
const weightRoutes = require('./routes/weight')

const app = express()
const PORT = process.env.PORT || 5001

app.get('/', (req, res) => {
  res.send('PaceLedger backend is alive!')
})

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
}))
app.use(express.json({ limit: '100kb' }))


app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1
      ? 'connected'
      : 'disconnected'
  })
})

app.use('/api/fitness', fitnessRoutes)
app.use('/api/workouts', workoutRoutes)
app.use("/api/nutrition", nutritionRoutes);
app.use('/api/sleep', sleepRoutes)
app.use('/api/weight', weightRoutes)

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI. Add it to server/.env')
    process.exit(1)
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('MongoDB connected successfully')

    app.listen(PORT, () => {
      console.log(`PaceLedger API running at http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Database connection failed:', error.message)
    process.exit(1)
  }
}
 

startServer()
