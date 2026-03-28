import { NextResponse } from "next/server";

type Persona = "engineer" | "trader" | "photographer";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { persona?: Persona; message?: string };
    const persona = body.persona ?? "engineer";
    const message = (body.message ?? "").toLowerCase();

    const aboutMap: Record<Persona, string> = {
      engineer:
        "Ratul is a software engineer focused on building modern product experiences with scalable frontend and backend integration.",
      trader:
        "Ratul approaches trading with process discipline: risk control, journaling, and decision quality over impulse.",
      photographer:
        "Ratul is also a photographer focused on composition, portrait lighting, and visual storytelling.",
    };

    if (
      message.includes("connect") ||
      message.includes("hire") ||
      message.includes("contact")
    ) {
      return NextResponse.json({
        reply:
          "Absolutely. I can collect your details here in chat and send the request directly to Ratul.",
        startLeadFlow: true,
      });
    }

    if (message.includes("social") || message.includes("github") || message.includes("linkedin")) {
      return NextResponse.json({
        reply:
          "You can reach Ratul via GitHub: https://github.com/royal-programmer, LinkedIn: https://www.linkedin.com, Email: ratul.arya.roy@gmail.com",
      });
    }

    if (message.includes("about") || message.includes("who")) {
      return NextResponse.json({ reply: aboutMap[persona] });
    }

    return NextResponse.json({
      reply:
        `${aboutMap[persona]} You can ask for socials, projects, or type "connect" to share your details.`,
    });
  } catch {
    return NextResponse.json(
      { reply: "I could not process that request." },
      { status: 400 },
    );
  }
}
