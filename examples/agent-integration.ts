import { CreateMemoryRecord } from '../src/domain/memory';
import { MemoryRepository } from '../src/infrastructure/persistence/MemoryRepository';

async function agentMemoryExample() {
  console.log("NamoNexus Sovereign Platform v3 - Agent Memory Integration Example");

  const repository = new MemoryRepository();

  // Agent creates new memory
  const memory1 = CreateMemoryRecord({
    content: "ผู้ใช้ชอบธีมสีน้ำเงินเข้มและ Neon Cyan",
    tags: ["user-preference", "branding"],
    importance: 9,
    source: "User Interaction"
  });

  await repository.save(memory1);
  console.log("Memory record saved successfully");

  // Agent searches memory
  const memories = await repository.findByTags(["branding"]);
  console.log(`Found ${memories.length} records related to branding`);

  // Agent archives old memory
  if (memories.length > 0) {
    const oldMemory = memories[0];
    oldMemory.archive();
    await repository.save(oldMemory);
    console.log("Old memory has been archived");
  }

  console.log("Agent successfully used NamoNexus memory system");
}

agentMemoryExample().catch(console.error);
