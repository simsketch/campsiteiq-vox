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
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const INITIAL_MESSAGE = "Hello! How are you?"

app.post('/incoming-call', (c) => {
  const voiceResponse = new twiml.VoiceResponse()
  
  if (!getCookie(c, "messages")) {
    voiceResponse.say(INITIAL_MESSAGE)
    setCookie(c, "messages", JSON.stringify([
      {
        role: "system",
        content: `You are a helpful phone assistant for a pizza restaurant.
        The restaurant is open between 10-12pm.
        You can help the customer reserve a table for the restaurant.`
      },
      { role: "assistant", content: INITIAL_MESSAGE }
    ]))
  }
  console.log("call came in");
  voiceResponse.gather({
    input: ["speech"],
    speechTimeout: "auto",
    speechModel: 'experimental_conversations',
    action: '/respond',
    enhanced: true
  })
  c.header("Content-Type", "application/xml")
  return c.body(voiceResponse.toString())
});

app.post('/respond', async (c) => {
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
  voiceResponse.redirect({ method: "POST" }, "/incoming-call")
  c.header("Content-Type", "application/xml")
  return c.body(voiceResponse.toString());
});
// Start the server
/* app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
}); */
const port = 3000;
serve({
  fetch: app.fetch,
  port
})

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