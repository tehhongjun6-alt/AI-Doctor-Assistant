import 'dotenv/config'
import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 8002)

createApp().listen(port, () => {
  console.log(`Consultation backend running at http://127.0.0.1:${port}`)
})
