export const getForumSupport = async (prompt: string, memberContext: any): Promise<string> => {
  try {
    // Sanitize memberContext to only include essential profile & financial fields
    // This avoids sending large base64 avatar images or sensitive fields that cause 413 Payload Too Large
    const safeContext = memberContext ? {
      id: memberContext.id,
      name: memberContext.name,
      role: memberContext.role,
      totalSaved: memberContext.totalSaved,
      monthlySavings: memberContext.monthlySavings,
      totalDue: memberContext.totalDue,
      profitShare: memberContext.profitShare,
      joiningDate: memberContext.joiningDate,
      email: memberContext.email,
      phone: memberContext.phone,
    } : null;

    const response = await fetch('/api/gemini/support', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, memberContext: safeContext }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error ${response.status}`);
    }

    const data = await response.json();
    return data.text || 'দুঃখিত, কোনো উত্তর পাওয়া যায়নি।';
  } catch (error) {
    console.error('Gemini Support Error:', error);
    return 'দুঃখিত, আমি এই মুহূর্তে উত্তর দিতে পারছি না। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।';
  }
};
