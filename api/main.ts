import { Hono } from 'hono'
import { twiml } from 'twilio'
import OpenAI from 'openai';
import { getCookie, setCookie } from 'hono/cookie'
import type { IncomingMessage, ServerResponse } from 'http'

const app = new Hono();
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
  
  setCookie(c, "messages", JSON.stringify(messages))

  const voiceResponse = new twiml.VoiceResponse()
  voiceResponse.say(assistantResponse!)
  voiceResponse.redirect({ method: "POST" }, "/api/incoming-call")
  c.header("Content-Type", "application/xml")
  return c.body(voiceResponse.toString());
});

// Simple health check endpoint
app.get('/', (c) => c.text('Healthy'));

// Export the handler function for Vercel
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const chunks: Buffer[] = [];
  
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString();

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const request = new Request(url, {
    method: req.method,
    headers: new Headers(req.headers as Record<string, string>),
    body: body.length > 0 ? body : undefined
  });

  try {
    const response = await app.fetch(request);
    res.statusCode = response.status;
    
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value);
    }
    
    const responseBody = await response.text();
    res.end(responseBody);
  } catch (error) {
    console.error('Handler error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}