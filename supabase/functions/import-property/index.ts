import { createClient } from 'npm:@supabase/supabase-js@2'

console.log("🚀 Function starting...")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log("📋 CORS preflight request")
    return new Response('ok', { headers: corsHeaders })
  }

  console.log("📥 Processing", req.method, "request")

  try {
    // Step 1: Check Authorization header
    const authHeader = req.headers.get('Authorization')
    console.log("🔑 Auth header check:", {
      exists: !!authHeader,
      startsWithBearer: authHeader?.startsWith('Bearer '),
      length: authHeader?.length
    })
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("❌ Invalid or missing Authorization header")
      return new Response(
        JSON.stringify({ 
          error: 'Missing or invalid Authorization header',
          received: authHeader ? 'Header exists but invalid format' : 'No header'
        }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Step 2: Create Supabase client
    console.log("🔧 Creating Supabase client...")
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    console.log("🔧 Environment check:", {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      urlLength: supabaseUrl?.length,
      keyLength: supabaseAnonKey?.length
    })

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("❌ Missing environment variables")
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )
    console.log("✅ Supabase client created")

    // Step 3: Verify user authentication
    console.log("👤 Getting user...")
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    console.log("👤 User verification:", {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      error: userError?.message
    })
    
    if (userError || !user) {
      console.error("❌ User authentication failed:", userError)
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed', 
          details: userError?.message || 'No user found',
          code: userError?.code
        }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Authenticated as: ${user.id} (${user.email})`)

    // Step 4: Parse request body
    console.log("📄 Parsing request body...")
    let requestData: any = {}
    
    try {
      const bodyText = await req.text()
      console.log("📄 Raw body length:", bodyText.length)
      
      if (bodyText) {
        requestData = JSON.parse(bodyText)
        console.log("📄 Parsed data keys:", Object.keys(requestData))
      }
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 5: Test database connection
    console.log("🔍 Testing database connection...")
    const { data: testData, error: testError } = await supabaseClient
      .from('properties')
      .select('id')
      .limit(1)

    console.log("🔍 Database test:", {
      success: !testError,
      dataLength: testData?.length,
      error: testError?.message
    })

    if (testError) {
      console.error("❌ Database connection failed:", testError)
      return new Response(
        JSON.stringify({ 
          error: 'Database connection test failed', 
          details: testError.message,
          code: testError.code,
          hint: testError.hint
        }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 6: Prepare insert data
    const insertData = {
      user_id: user.id,
      // Add basic fields - adjust based on your table structure
      title: requestData.title || 'Test Property',
      description: requestData.description || 'Test Description',
      created_at: new Date().toISOString(),
      ...requestData
    }

    console.log("💾 Preparing insert:", {
      user_id: insertData.user_id,
      fieldsCount: Object.keys(insertData).length,
      fields: Object.keys(insertData)
    })

    // Step 7: Insert data
    console.log("💾 Inserting into properties table...")
    const { data, error } = await supabaseClient
      .from('properties')
      .insert(insertData)
      .select()

    if (error) {
      console.error("❌ Insert failed:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      
      return new Response(
        JSON.stringify({ 
          error: 'Insert operation failed', 
          details: error.message,
          code: error.code,
          hint: error.hint,
          insertData: insertData
        }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log("✅ Insert successful:", {
      rowsInserted: data?.length,
      insertedIds: data?.map((row: any) => row.id)
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Property imported successfully",
        data: data,
        user: {
          id: user.id,
          email: user.email
        }
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        stack: error.stack
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
