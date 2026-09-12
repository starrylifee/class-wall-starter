// ===================================================
// Gemini에게 물어보는 서버 코드 (Vercel 서버리스 함수)
//
// 왜 서버가 필요한가요?
//   API 키를 브라우저 코드(app.js)에 적으면 누구나 볼 수 있습니다.
//   그래서 키는 서버에만 두고, 브라우저는 이 주소(/api/gemini)로 요청합니다.
//
// 왜 Firebase Functions가 아니라 여기인가요?
//   Firebase Functions는 유료 요금제(Blaze)라야 씁니다.
//   이 프로젝트는 무료 요금제(Spark)로 진행하므로,
//   서버가 필요한 일은 Vercel의 무료 함수로 처리합니다.
// ===================================================

export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "메모 내용이 없습니다." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Vercel 환경변수에 GEMINI_API_KEY가 설정되지 않았습니다."
    });
  }

  try {
    // 최신 Gemini 2.0 Flash 모델 (기본 무료 티어 지원)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;


    const prompt = `너는 초·중등학교 교실의 따뜻하고 격려를 아끼지 않는 친절한 AI 선생님 도우미야.
학생이 작성한 아래 메모 글을 읽고, 학생에게 힘이 되고 배움을 응원하는 다정하고 긍정적인 한 줄 코멘트(1~2문장, 80자 이내)를 작성해줘. 이모지도 친근하게 1~2개 곁들여줘.

[학생의 메모 내용]:
${text}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorData.error?.message || "Gemini API 호출에 실패했습니다."
      });
    }

    const data = await response.json();
    const comment = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "좋은 생각이에요! 멋진 메모 고마워요. ✨";

    return res.status(200).json({ comment });
  } catch (error) {
    console.error("Gemini 호출 중 오류:", error);
    return res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
  }
}

