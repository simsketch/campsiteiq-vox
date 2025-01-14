import express, { Request, Response } from 'express';
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { config } from 'dotenv';
import { logger } from 'hono/logger'
import { twiml } from 'twilio'
import OpenAI from 'openai';
import { getCookie, setCookie } from 'hono/cookie'

// Load environment variables
config();

const app = new Hono();
console.log('Creating Hono app and registering routes...');

// Add logging middleware to see incoming requests
app.use('*', async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const INITIAL_MESSAGE = "Welcome to Pine Valley Campground powered by CampsiteIQ! How can I help you today?"

app.post('/api/incoming-call', (c) => {
  const voiceResponse = new twiml.VoiceResponse()
  
  if (!getCookie(c, "messages")) {
    voiceResponse.say(INITIAL_MESSAGE)
    setCookie(c, "messages", JSON.stringify([
      {
        role: "system",
        content: `You are a helpful phone assistant for Pine Valley Campground.
        The campground is open year-round and offers:
        - 50 RV sites with full hookups ($45/night)
        - 30 tent camping sites ($25/night)
        - 5 rustic cabins ($85/night)
        
        Amenities include:
        - Hot showers and restrooms
        - Camp store
        - Hiking trails
        - Fishing lake
        - Playground
        
        Check-in time is 2pm, check-out is 11am.
        Reservations require a credit card to hold the spot.
        Pets are welcome with a $5/night fee.
        
        When taking reservations, collect:
        1. Type of site needed (RV, tent, or cabin)
        2. Dates of stay
        3. Number of people
        4. Name for reservation
        
        Be friendly and helpful. If asked about availability, say you'll check and transfer them to reservations.`
      },
      { role: "assistant", content: INITIAL_MESSAGE }
    ]))
  }
  console.log("call came in");
  voiceResponse.gather({
    input: ["speech"],
    speechTimeout: "auto",
    speechModel: 'experimental_conversations',
    action: '/api/respond',
    enhanced: true
  })
  c.header("Content-Type", "application/xml")
  return c.body(voiceResponse.toString())
});

app.post('/api/respond', async (c) => {
  console.log("response came in");
  const formData = await c.req.formData()
  const voiceInput = formData.get("SpeechResult")?.toString()!

  let messages = JSON.parse(getCookie(c, "messages")!)
  messages.push({ role: "user", content: voiceInput })

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages,
    temperature: 0,
  });

  const assistantResponse = chatCompletion.choices[0].message.content;
  messages.push({ role: "assistant", content: assistantResponse });
  console.log(messages)
  
  setCookie(c, "messages", JSON.stringify(messages))

  const voiceResponse = new twiml.VoiceResponse()
  voiceResponse.say(assistantResponse!)
  voiceResponse.redirect({ method: "POST" }, "/api/incoming-call")
  c.header("Content-Type", "application/xml")
  return c.body(voiceResponse.toString());
});
// Start the server
/* app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
}); */
const port = 3000;
const server = serve({
  fetch: app.fetch,
  port
});

console.log(`Server is running on http://localhost:${port}`);

/*
function addEvent() {
  // Explanation of how the search section works (as it is NOT quite like most things Google) as part of the getEvents function:
  //    {search: 'word1'}              Search for events with word1
  //    {search: '-word1'}             Search for events without word1
  //    {search: 'word1 word2'}        Search for events with word2 ONLY
  //    {search: 'word1-word2'}        Search for events with ????
  //    {search: 'word1 -word2'}       Search for events without word2
  //    {search: 'word1+word2'}        Search for events with word1 AND word2
  //    {search: 'word1+-word2'}       Search for events with word1 AND without word2
  //    {search: '-word1+-word2'}      Search for events without word1 AND without word2 (I find this to work logically like an 'OR' statement)
  try {
    let calendar = CalendarApp.getDefaultCalendar();
    let events = calendar.getEvents( new Date('August 20, 2022 00:00:00 GMT-7'), new Date('August 20, 2022 23:59:59 GMT-7'), { search: 'Alabama'} );
    if( events.length === 0 ) {
      calendar.createEvent('Alabama', new Date('August 20, 2022 00:00:00 GMT-7'), new Date('August 20, 2022 23:59:59 GMT-7'));
      console.log("created");
    }
  }
  catch(err) {
    console.log(err);
  }
}
*/