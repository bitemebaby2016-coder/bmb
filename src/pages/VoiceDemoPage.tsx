import React from 'react';
import { VoiceInterface } from '@/components/VoiceInterface';
import './VoiceDemoPage.css';

export const VoiceDemoPage: React.FC = () => {
  return (
    <div className="voice-demo-page">
      <div className="demo-container">
        <header className="demo-header">
          <h1>🎙️ AI Voice Assistant Demo</h1>
          <p className="demo-subtitle">
            พูดคุยกับ AI Voice ของ Bite Me Baby — ใช้ OpenRouter (Qwen 3.7 Flash / GLM 5.3 Flash Fallback)
          </p>
        </header>

        <main className="demo-main">
          <section className="demo-section">
            <h2>วิธีใช้งาน</h2>
            <ul className="instructions">
              <li><strong>กดไอคอนไมค์</strong> เพื่อเริ่มพูด (Web Speech API STT)</li>
              <li><strong>พูดเป็นภาษาไทย</strong> — AI จะประมวลผลผ่าน OpenRouter (Qwen 3.7 Flash)</li>
              <li><strong>AI จะตอบกลับด้วยเสียง</strong> (Web Speech API TTS)</li>
              <li>หรือพิมพ์ข้อความในช่องด้านล่างได้เช่นกัน</li>
            </ul>
          </section>

          <section className="demo-section">
            <h2>สิ่งที่ AI Voice ช่วยได้</h2>
            <div className="capabilities-grid">
              <div className="capability-card">
                <h3>🍽️ สั่งอาหาร</h3>
                <p>SAME_DAY และ PRE_ORDER — ตรวจสอบเมนู ราคา โปรโมชัน</p>
              </div>
              <div className="capability-card">
                <h3>📦 ติดตามออเดอร์</h3>
                <p>เช็คสถานะ การจัดส่ง เวลาประมาณ</p>
              </div>
              <div className="capability-card">
                <h3>📍 ข้อมูลจัดส่ง</h3>
                <p>พื้นที่ ค่าส่ง ระยะทาง (5km gate)</p>
              </div>
              <div className="capability-card">
                <h3>❌ ยกเลิก/แก้ไข</h3>
                <p>ตามนโยบาย cutoff และ refund</p>
              </div>
            </div>
          </section>

          <section className="demo-section">
            <h2>โมเดล AI</h2>
            <div className="model-info">
              <div className="model-card primary">
                <h4>🥇 Primary</h4>
                <code>qwen/qwen3.7-flash</code>
                <p>ตอบเป็นภาษาไทยได้ดี เร็ว ~ฟรี</p>
              </div>
              <div className="model-card fallback">
                <h4>🔄 Fallback</h4>
                <code>z-ai/glm-5.3-flash</code>
                <p>รองรับภาษาไทย เร็ว ฟรี</p>
              </div>
            </div>
            <p className="note">🔒 คำขอทั้งหมดส่งผ่าน <code>ai-proxy</code> (Supabase Edge Function) — OpenRouter key เก็บฝั่ง server เท่านั้น</p>
          </section>

          <section className="demo-section">
            <h2>สถาปัตยกรรม</h2>
            <pre className="architecture-diagram">{`Voice Input (Web Speech API)
       ↓
Speech-to-Text (Browser STT)
       ↓
AI Processing (OpenRouter)
       ↓
Function Calling → Authorized Backend Tools
       ↓
Text-to-Speech (Browser TTS)
       ↓
Voice Output`}</pre>
          </section>
        </main>

        {/* Voice Interface Component */}
        <VoiceInterface />
      </div>
    </div>
  );
};

export default VoiceDemoPage;