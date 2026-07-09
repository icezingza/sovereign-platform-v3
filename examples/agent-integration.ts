import { MemoryRecord, CreateMemoryRecord } from '../src/domain/memory';
import { MemoryRepository } from '../src/infrastructure/persistence/MemoryRepository';

async function agentMemoryExample() {
  console.log("🤖 NamoNexus Sovereign Platform v3 - Agent Memory Integration Example");

  const repository = new MemoryRepository();

  // Agent บันทึกความรู้ใหม่
  const memory1 = CreateMemoryRecord({
    content: "ผู้ใช้ชอบธีมสีน้ำเงินเข้มและ Neon Cyan",
    tags: ["user-preference", "branding"],
    importance: 9,
    source: "User Interaction"
  });

  await repository.save(memory1);
  console.log("💾 บันทึกความทรงจำผู้ใช้เรียบร้อย");

  // Agent ค้นหาความทรงจำ
  const memories = await repository.findByTags(["branding"]);
  console.log(`พบ ${memories.length} รายการที่เกี่ยวข้องกับ branding`);

  // Agent ทำการ Archive ความทรงจำเก่า
  if (memories.length > 0) {
    const oldMemory = memories[0];
    oldMemory.archive();
    await repository.save(oldMemory);
    console.log("📦 เก็บถาวรความทรงจำเก่าแล้ว");
  }

  console.log("🎉 Agent ใช้งานระบบความจำ NamoNexus สำเร็จ!");
}

agentMemoryExample().catch(console.error);
