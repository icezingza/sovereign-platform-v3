import { MemoryRecord, CreateMemoryRecord } from '../src/domain/memory';

async function main() {
  console.log("NamoNexus Sovereign Platform v3 - Basic Example");

  // Create a new Memory Record
  const memory = CreateMemoryRecord({
    content: "การประชุมครั้งแรกกับทีมพัฒนา AI",
    tags: ["meeting", "planning"],
    importance: 8
  });

  console.log("Created Memory Record:", memory.getContent());
  console.log("Status:", memory.getStatus());

  // Change status
  memory.archive();
  console.log("Memory status changed to Archived");
}

main().catch(console.error);
