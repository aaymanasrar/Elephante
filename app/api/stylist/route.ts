import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { occasion } = await req.json();

    // 1. Ask OpenAI for the outfit idea
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: `You are a fashion stylist. Describe a detailed, beautiful outfit for this occasion: ${occasion}. Focus on colors and fabrics. Keep it under 3 sentences.` }]
      })
    });
    const aiData = await aiResponse.json();
    const description = aiData.choices[0].message.content;

    // 2. Ask Skywork for the picture
    const skyworkResponse = await fetch('https://api.skywork.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SKYWORK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: `A full body fashion photoshoot of this outfit: ${description}. High quality, photorealistic.`,
        model: "skywork-flux-1-fashion" 
      })
    });
    const imageData = await skyworkResponse.json();

    // Send the text and image back to your website
    return NextResponse.json({ text: description, image: imageData.url });
    
  } catch (error) {
    console.log("Error:", error);
    return NextResponse.json({ error: "Something went wrong!" }, { status: 500 });
  }
}