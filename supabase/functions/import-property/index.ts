// supabase/functions/import-property/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.2";
import { OpenAI } from "https://esm.sh/openai@4.52.7";
import * as pdfjs from "https://cdn.skypack.dev/pdfjs-dist/build/pdf.min.js";

const PROPERTY_JSON_SCHEMA = {
  address: "string", price: "number", bedrooms: "number", bathrooms: "number",
  car_spaces: "number", land_area_sqm: "number", house_area_sqm: "number",
  description: "string", features: "array<string>",
};

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- NEW, CORRECT AUTHENTICATION PATTERN ---
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: "", // Not needed for this one-off request
    });

    if (sessionError) {
      throw new Error("Failed to set user session from token");
    }
    // --- END OF NEW PATTERN ---

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Could not get user from session");

    const { pdfUrl, fileName } = await req.json();
    if (!pdfUrl) throw new Error("PDF URL is required");

    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    const pdfBytes = new Uint8Array(await response.arrayBuffer());

    let fullText = "";
    const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(" ");
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: `You are a real estate data extraction bot. Extract details into this JSON schema: ${JSON.stringify(PROPERTY_JSON_SCHEMA)}` },
        { role: "user", content: fullText },
      ],
      response_format: { type: "json_object" },
    });

    const propertyData = JSON.parse(completion.choices[0].message.content || "{}");

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
