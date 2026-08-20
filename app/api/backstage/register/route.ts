import { NextRequest, NextResponse } from "next/server";

interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  eventId: string;
  ticketClassId: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

interface ZohoAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZohoOrderResponse {
  code: number;
  message: string;
  order_id?: string;
  tickets?: Array<{
    ticket_id: string;
    ticketclass_id: string;
  }>;
}

async function getAccessToken(): Promise<string> {
  const refreshToken = process.env.ZOHO_BACKSTAGE_REFRESH_TOKEN;
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const accountsDomain = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error("Missing Zoho OAuth credentials");
  }

  const tokenUrl = `${accountsDomain}/oauth/v2/token`;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    body: params,
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const data: ZohoAccessTokenResponse = await response.json();
  return data.access_token;
}

async function createBackstageOrder(
  accessToken: string,
  portalId: string,
  eventId: string,
  ticketClassId: string,
  firstName: string,
  lastName: string,
  email: string,
  phone?: string,
  utmSource?: string,
  utmMedium?: string,
  utmCampaign?: string
): Promise<ZohoOrderResponse> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://zohoapis.com";
  const orderUrl = `${apiDomain}/backstage/v3/portals/${portalId}/events/${eventId}/orders`;

  const ticketData: Record<string, string> = {
    first_name: firstName,
    last_name: lastName,
    email: email,
    ...(phone && { mobile_no: phone }),
  };

  if (utmSource) {
    ticketData.UTM_Source = utmSource;
  }
  if (utmMedium) {
    ticketData.UTM_Medium = utmMedium;
  }
  if (utmCampaign) {
    ticketData.UTM_Campaign = utmCampaign;
  }

  const payload = {
    buyer_details: {
      purchaser_first_name: firstName,
      purchaser_last_name: lastName,
      purchaser_email: email,
      ...(phone && { purchaser_mobile_no: phone }),
    },
    tickets: [
      {
        ticketclass_id: ticketClassId,
        data: ticketData,
      },
    ],
  };

  const response = await fetch(orderUrl, {
    method: "POST",
    headers: {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data: ZohoOrderResponse = await response.json();

  if (!response.ok) {
    throw new Error(`Backstage API error: ${data.message || response.statusText}`);
  }

  return data;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.email || !body.eventId || !body.ticketClassId) {
      return NextResponse.json(
        { error: "Missing required fields: firstName, lastName, email, eventId, ticketClassId" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const portalId = process.env.ZOHO_BACKSTAGE_PORTAL_ID;
    if (!portalId) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Get access token
    const accessToken = await getAccessToken();

    // Create order in Backstage
    const orderResponse = await createBackstageOrder(
      accessToken,
      portalId,
      body.eventId,
      body.ticketClassId,
      body.firstName,
      body.lastName,
      body.email,
      body.phone,
      body.utmSource,
      body.utmMedium,
      body.utmCampaign
    );

    return NextResponse.json({
      success: true,
      orderId: orderResponse.order_id,
      tickets: orderResponse.tickets,
      message: "Registration successful",
    });
  } catch (error) {
    console.error("Backstage registration error:", error instanceof Error ? error.message : String(error));

    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
