// supabase/functions/import-property/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.2";
import { OpenAI } from "https://esm.sh/openai@4.52.7";
import * as pdfjs from "https://cdn.skypack.dev/pdfjs-dist/build/pdf.min.js";

// Define the expected output format for GPT-4o
const PROPERTY_JSON_SCHEMA = {
  address: "string",
  price: "number",
  bedrooms: "number",
  bathrooms: "number",
  car_spaces: "number",
  land_area_sqm: "number",
  house_area_sqm: "number",
  description: "string",
  features: "array<string>",
};

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create a Supabase client THAT USES THE USER'S LOGIN TOKEN
    // This is the critical change.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // We need the user's ID to associate with the new property
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found.");

    const { pdfUrl, fileName } = await req.json();

    if (!pdfUrl) {
      return new Response(JSON.stringify({ error: "PDF URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the PDF and read its content
    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    const pdfBytes = new Uint8Array(await response.arrayBuffer());

    // Parse text from the PDF
    let fullText = "";
    const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(" ");
    }

    // Use OpenAI GPT-4o to parse the text
    const completion = await openai.chat.complentions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a highly specialized real estate data extraction bot. Your task is to parse the provided text from a real estate property PDF and extract key details into a structured JSON format. The output must strictly adhere to the following JSON schema: ${JSON.stringify(PROPERTY_JSON_SCHEMA, null, 2)}`,
        },
        {
          role: "user",
          content: fullText,
        },
      ],
      response_format: { type: "json_object" },
    });

    const propertyData = JSON.parse(completion.choices[0].message.content || "{}");

    // Insert data into the Supabase database, including the user's ID
    // IMPORTANT: Make sure your 'properties' table has a 'user_id' column that can link to auth.users(id)
    const { data, error } = await supabase
      .from("properties")
      .insert({
        user_id: user.id,
        address: propertyData.address,
        price: propertyData.price,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        car_spaces: propertyData.car_spaces,
        land_area_sqm: propertyData.land_area_sqm,
        house_area_sqm: propertyData.house_area_sqm,
        description: propertyData.description,
        features: propertyData.features,
        status: "imported",
        source_pdf_name: fileName,
      })
      .select()
      .single();

    if (error) throw new Error(`Database insert error: ${error.message}`);

    return new Response(JSON.stringify({ success: true, property: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
