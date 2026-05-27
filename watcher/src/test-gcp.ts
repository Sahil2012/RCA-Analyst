console.log('FILE STARTED')
import dotenv from 'dotenv'
dotenv.config()

import { Logging } from '@google-cloud/logging'

async function testLogs() {
  try {
    console.log('INSIDE FUNCTION')
    const logging = new Logging({
      projectId: process.env.GCP_PROJECT_ID,
    })

    const [entries] = await logging.getEntries({
      pageSize: 5,
    })
    console.log('Project ID:', process.env.GCP_PROJECT_ID)
    console.log('Entries found:', entries.length)

    for (const entry of entries) {
      console.log(entry.metadata)
    }
  } catch (err) {
    console.error(err)
  }
}

testLogs()