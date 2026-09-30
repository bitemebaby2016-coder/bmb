const fs = require("fs");
const path = "src";

// Image replacement maps for each dish
const dishImages = {
  "ผัดไทยกุ้งสด": { emoji: "🍜", category: "จานเดียว" },
  "ข้าวหมทอดกระเทียม": { emoji: "🍚", category: "ข้าว" },
  "ข้าวหมึกทอดกระเทียม": { emoji: "🍚", category: "ข้าว" },
  "แกงเขียวหวานไก่": { emoji: "🍛", category: "แกง" },
  "กาแฟเยน": { emoji: "☕", category: "เครื่องดื่ม" },
  "กาแฟเยน": { emoji: "☕", category: "เครื่องดื่ม" },
  "ไข่ดาวน้ำมัน": { emoji: "🍳", category: "จานเดียว" },
  "ขนมปังกรอบ": { emoji: "🍞", category: "ของหวาน" },
};

function replaceImageUrls(content, fileName) {
  // Replace image: url patterns with emoji data
  const regex = /image:\s*[\x27"]https:\/\/images\.unsplash\.com[^\x27"]+[\x27"]\s*,\s*(category:[^,}]+)/g;
  
  content = content.replace(regex, (match, categoryPart) => {
    // Determine emoji based on filename and context
    let emoji = "🍽️";
    if (fileName.includes("HomePage")) {
      if (categoryPart.includes("จานเดียว")) emoji = "🍜";
      else if (categoryPart.includes("ข้าว")) emoji = "🍚";
      else if (categoryPart.includes("แกง")) emoji = "🍛";
      else if (categoryPart.includes("เครื่องดื่ม")) emoji = "☕";
    } else if (fileName.includes("MenuPage")) {
      if (categoryPart.includes("จานเดียว") || !categoryPart.includes("เครื่องดื่")) emoji = "🍜";
      else if (categoryPart.includes("เครื่องดื่ม")) emoji = "☕";
      else if (categoryPart.includes("แกง")) emoji = "🍛";
      else if (categoryPart.includes("ของหวาน")) emoji = "🍰";
      else emoji = "🍽️";
    }
    return `emoji: \x27${emoji}\x27`;
  });
  
  return content;
}

function fixThaiTypos(content) {
  const replacements = [
    ["สุ่มเมน", "สุ่มเมน"],
    ["รอบเยน", "รอบเยน"],
    ["ปรมชั่น", "ปรมชั่น"],
    ["สั่งื้อ", "สั่งื้อ"],
    ["คปอง", "คปอง"],
    ["หวตเมน", "หวตเมน"],
    ["ดเมน", "ดเมน"],
    ["ลกค้าใหม่", "ลกค้าใหม่"],
    ["เชิเพื่อน", "เชิเพื่อน"],
    ["คุและ", "คุและ"],
    ["กำลั", "กำลัง"],
    ["สำเรจ", "สำเรจ"],
    ["กรุา", "กรุา"],
    ["ที่อย่", "ที่อย่"],
    ["วิีการ", "วิีการ"],
    ["ออเดอร", "ออรเดอร"],
    ["ส่งสำเรจ", "ส่งสำเรจ"],
    ["ขอบคุ", "ขอบคุ"],
    ["ทรหาเรา", "ติดต่อเรา"],
    ["ประสพการ", "ประสบการ"],
    ["พนบริการ", "พันาบริการ"],
    ["วันที", "วันที่"],
    ["วัตถุดิบลด", "วัตถุดิบใกล้หมด"],
    ["ระบบคำนว", "ระบบคำนว"],
    ["ล้างตะกร้า", "ล้างตะกร้า"],
    ["คปอง", "คปอง"],
    ["ใช้ค้ด", "ใช้ค้ด"],
    ["ระบุ", "ระบุ"],
    ["รับ", "รับ"],
    ["รอบเช้า", "รอบเช้า"],
    ["รอบกลางวัน", "รอบกลางวัน"],
    ["สุ่มเมนให้เลย", "สุ่มเมนให้เลย"],
    ["ช่วยเลือก", "ช่วยเลือก"],
    ["วตแล้ว กรุ", "หวตแล้ว กรุ"],
    ["เคลดลับ", "เคลดลับ"],
    ["หวตทุกสัปดาหห", "หวตทุกสัปดาห"],
    ["วต", "หวต"],
    ["ล้อสุ่มแต้ม", "วงล้อสุ่มแต้ม"],
    ["แลกเงินัน", "แลกเปลี่ยน"],
    ["รางวัลและ", "รางวัลและ"],
  ];
  
  replacements.forEach(([from, to]) => {
    content = content.split(from).join(to);
  });
  
  return content;
}

// Process all page files
const pagesDir = path + "/pages";
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith(".tsx"));
let totalChanges = 0;

files.forEach(file => {
  const filePath = pagesDir + "/" + file;
  try {
    let content = fs.readFileSync(filePath, "utf8");
    const original = content;
    
    // Step 1: Replace image URLs
    content = replaceImageUrls(content, file);
    
    // Step 2: Fix Thai typos
    content = fixThaiTypos(content);
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log("✓ Fixed: " + file);
      const changes = (original.length - content.length) * -1;
      totalChanges += Math.max(0, changes);
    } else {
      console.log("- No changes: " + file);
    }
  } catch(e) {
    console.log("✗ Error: " + file + " - " + e.message);
  }
});

console.log("\nDone! Total approx chars changed: " + totalChanges);
