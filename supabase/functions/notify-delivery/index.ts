// Edge Function triggered by Supabase Webhooks:
import "@supabase/functions-js/edge-runtime.d.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_SMS_FROM = Deno.env.get('TWILIO_SMS_FROM')!;
const NOTIFY_PHONE_NUMBER = Deno.env.get('NOTIFY_PHONE_NUMBER')!;

Deno.serve(async (req) => {
    try {
        const payload = await req.json();
        const record = payload.record;

        if (!record) {
            return new Response(JSON.stringify({ error: 'No record found' }), { status: 400 });
        }

        const { tracking_number, image_url, latitude, longitude, captured_at } = record;

        const message = [
            `Delivery Confirmed`,
            ``,
            `Tracking: ${tracking_number}`,
            `Time: ${new Date(captured_at).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}`,
            `GPS: ${parseFloat(latitude).toFixed(6)}, ${parseFloat(longitude).toFixed(6)}`,
            ``,
            `Proof of Delivery:`,
            `${image_url}`,
        ].join('\n');

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

        const body = new URLSearchParams({
            From: TWILIO_SMS_FROM,
            To: NOTIFY_PHONE_NUMBER,
            Body: message,
        });

        const response = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Twilio error:', result);
            return new Response(JSON.stringify({ error: result }), { status: 500 });
        }

        return new Response(JSON.stringify({ success: true, sid: result.sid }), { status: 200 });

    } catch (err) {
        console.error('Edge function error:', err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
});

// // Follow this setup guide to integrate the Deno language server with your editor:
// // https://deno.land/manual/getting_started/setup_your_environment
// // This enables autocomplete, go to definition, etc.
//
// // Setup type definitions for built-in Supabase Runtime APIs
// import "@supabase/functions-js/edge-runtime.d.ts"
//
// console.log("Hello from Functions!")
//
// Deno.serve(async (req) => {
//   const { name } = await req.json()
//   const data = {
//     message: `Hello ${name}!`,
//   }
//
//   return new Response(
//     JSON.stringify(data),
//     { headers: { "Content-Type": "application/json" } },
//   )
// })
//
// /* To invoke locally:
//
//   1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
//   2. Make an HTTP request:
//
//   curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/notify-delivery' \
//     --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//     --header 'Content-Type: application/json' \
//     --data '{"name":"Functions"}'
//
// */
