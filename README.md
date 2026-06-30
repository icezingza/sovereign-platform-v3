# NaMo Sovereign Platform v3

NaMo Sovereign Platform v3 เป็นระบบความจำและกระบวนการคิดเชิง AI ที่ออกแบบตามแนวทาง DDD (Domain-Driven Design) เขียนด้วย TypeScript (monorepo planned)

## คำอธิบายสั้น
- DDD-based AI memory & cognition system
- โดเมนหลัก: MemoryRecord aggregate (สถานะ: ACTIVE, ARCHIVED, FORGOTTEN, DELETED)

## Quickstart
1. ติดตั้ง dependencies

   npm ci

2. ตรวจสอบชนิดไฟล์ (TypeScript)

   npm run typecheck

3. รันทดสอบ

   npm test

4. รันแบบ watch

   npm run test:watch

## โครงสร้างโปรเจกต์ (โดยย่อ)
- src/
  - domain/ — โดเมนหลัก (MemoryRecord อยู่ใน `src/domain/memory/`)
  - infrastructure/ — adapters เช่น repository, mappers
  - __tests__/ — unit tests (Jest)

สถาปัตยกรรมหลัก: Domain ← Application ← Infrastructure
- Domain: ไม่มี dependency กับ framework ภายนอก
- Application: orchestrates (ไม่ใส่ business logic)
- Infrastructure: adapters (persistence, ORM)

## การทดสอบและ conventions
- ใช้ Jest (ดู jest.config.js)
- tests สำคัญ: `src/__tests__/domain/memory/memory-record.spec.ts`
- ใช้ FakeClock เพื่อให้เวลา deterministic
- Snapshot/reconstitute pattern: `toSnapshot()` และ `reconstitute()`

## สคริปต์ที่สำคัญ (จาก package.json)
- npm run typecheck — tsc --noEmit
- npm test — jest
- npm run test:coverage — jest --coverage

## ข้อควรระวัง
- better-sqlite3 เป็น native dependency ที่ต้องคอมไพล์บน runner/เครื่อง dev — ถ้า CI ล้ม อาจต้องติดตั้ง build tools (ตัวอย่าง workflow ติดตั้ง `build-essential` และ `python3`)
- ใน CI เราใช้ `--runInBand` กับ Jest เพื่อลดปัญหา race conditions กับไฟล์ SQLite

## CI
- มี workflow ตัวอย่าง `.github/workflows/ci.yml` ใน branch นี้ที่จะรัน typecheck และ tests บน Node.js 18 และ 20

## Contributing
- โปรดเปิด Pull Requestสำหรับงานใหม่ และรัน tests/local typecheck ก่อน
- หากต้องการ ผมสามารถช่วยตั้ง Dependabot, PR templates, และ branch protection ได้

---

(เอกสารนี้ย่อจาก CLAUDE.md — หากต้องการ README ภาษาอังกฤษแบบเต็มหรือจะเพิ่มส่วน Contribution / Badge / Examples เพิ่มเติม แจ้งผมได้)
