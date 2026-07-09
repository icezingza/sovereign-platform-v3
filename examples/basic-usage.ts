import { MemoryRecord, MemoryStatus, CreateMemoryRecord } from '../src/domain/memory';

async function main() {
  console.log("🚀 NamoNexus Sovereign Platform v3 - Basic Example");

  // สร้าง Memory Record
  const memory = CreateMemoryRecord({
    content: "การประชุมครั้งแรกกับทีมพัฒนา AI",
    tags: ["meeting", "planning"],
    importance: 8
  });

  console.log("✅ สร้าง Memory สำเร็จ:", memory.getContent());
  console.log("สถานะ:", memory.getStatus());

  // เปลี่ยนสถานะ
  memory.archive();
  console.log("📦 เปลี่ยนเป็น Archived แล้ว");
}

main().catch(console.error);
