import {
  defaultSettings,
  emptyState,
  keyOf,
  type Exercise,
  type Language,
  type LocalState,
  type Movement,
  type Plan,
  type Workout,
} from "./index";

export const exercises: Exercise[] = [
  {
    id: "bench",
    name: { ru: "Жим штанги лёжа", en: "Barbell bench press" },
    muscle: { ru: "Грудь", en: "Chest" },
    equipment: { ru: "Штанга", en: "Barbell" },
    description: {
      ru: "Лёжа на скамье, опустите штангу к груди и выжмите вверх контролируемым движением.",
      en: "Lie on a bench, lower the bar towards your chest, then press up with control.",
    },
  },
  {
    id: "squat",
    name: { ru: "Приседания со штангой", en: "Barbell squat" },
    muscle: { ru: "Ноги", en: "Legs" },
    equipment: { ru: "Штанга", en: "Barbell" },
    description: {
      ru: "Сохраняя устойчивое положение, согните ноги и вернитесь в исходную позицию.",
      en: "Keep a stable stance, bend your legs, and return to the starting position.",
    },
  },
  {
    id: "row",
    name: { ru: "Тяга штанги в наклоне", en: "Bent-over barbell row" },
    muscle: { ru: "Спина", en: "Back" },
    equipment: { ru: "Штанга", en: "Barbell" },
    description: {
      ru: "Удерживайте корпус в наклоне и тяните штангу к поясу без рывков.",
      en: "Maintain a hinged position and pull the bar towards your waist without jerking.",
    },
  },
  {
    id: "deadlift",
    name: { ru: "Румынская тяга", en: "Romanian deadlift" },
    muscle: { ru: "Ноги", en: "Legs" },
    equipment: { ru: "Штанга", en: "Barbell" },
    description: {
      ru: "Отведите таз назад, опуская штангу вдоль ног; затем выпрямитесь.",
      en: "Hinge at the hips and lower the bar along your legs, then stand tall.",
    },
  },
  {
    id: "press",
    name: { ru: "Жим гантелей сидя", en: "Seated dumbbell press" },
    muscle: { ru: "Плечи", en: "Shoulders" },
    equipment: { ru: "Гантели", en: "Dumbbells" },
    description: {
      ru: "Сидя на скамье, выжмите гантели от плеч вверх и плавно опустите.",
      en: "Seated on a bench, press the dumbbells overhead and lower with control.",
    },
  },
  {
    id: "pulldown",
    name: { ru: "Тяга верхнего блока", en: "Lat pulldown" },
    muscle: { ru: "Спина", en: "Back" },
    equipment: { ru: "Тренажёр", en: "Machine" },
    description: {
      ru: "Подтяните рукоять к верхней части груди, затем плавно отпустите.",
      en: "Pull the handle towards your upper chest, then release with control.",
    },
  },
  {
    id: "curl",
    name: { ru: "Сгибание рук с гантелями", en: "Dumbbell curl" },
    muscle: { ru: "Руки", en: "Arms" },
    equipment: { ru: "Гантели", en: "Dumbbells" },
    description: {
      ru: "Согните руки в локтях, поднимая гантели; удерживайте корпус неподвижно.",
      en: "Bend your elbows to lift the dumbbells while keeping your torso still.",
    },
  },
  {
    id: "lunge",
    name: { ru: "Выпады с гантелями", en: "Dumbbell lunge" },
    muscle: { ru: "Ноги", en: "Legs" },
    equipment: { ru: "Гантели", en: "Dumbbells" },
    description: {
      ru: "Сделайте шаг вперёд, согните ноги и вернитесь в исходное положение.",
      en: "Step forward, bend both legs, and return to your starting position.",
    },
  },
  {
    id: "pushup",
    name: { ru: "Отжимания", en: "Push-up" },
    muscle: { ru: "Грудь", en: "Chest" },
    equipment: { ru: "Собственный вес", en: "Bodyweight" },
    bodyweight: true,
    description: {
      ru: "Из положения упора опустите корпус и выпрямите руки.",
      en: "From a plank position, lower your torso and straighten your arms.",
    },
  },
  {
    id: "pullup",
    name: { ru: "Подтягивания", en: "Pull-up" },
    muscle: { ru: "Спина", en: "Back" },
    equipment: { ru: "Турник", en: "Pull-up bar" },
    bodyweight: true,
    description: {
      ru: "Подтяните корпус к перекладине и плавно опуститесь.",
      en: "Pull yourself towards the bar and lower with control.",
    },
  },
  {
    id: "goblet",
    name: { ru: "Гоблет-приседания", en: "Goblet squat" },
    muscle: { ru: "Ноги", en: "Legs" },
    equipment: { ru: "Гантели", en: "Dumbbells" },
    description: {
      ru: "Удерживайте гантель перед грудью, присядьте и встаньте.",
      en: "Hold a dumbbell at your chest, squat down, and stand up.",
    },
  },
  {
    id: "lateral",
    name: { ru: "Разведение гантелей", en: "Dumbbell lateral raise" },
    muscle: { ru: "Плечи", en: "Shoulders" },
    equipment: { ru: "Гантели", en: "Dumbbells" },
    description: {
      ru: "Поднимите руки с гантелями в стороны и медленно опустите.",
      en: "Raise the dumbbells out to your sides and lower slowly.",
    },
  },
];
export const templateNames: Record<string, { ru: string; en: string }> = {
  "00000000-0000-4000-8000-000000000001": {
    ru: "Всё тело · A",
    en: "Full body · A",
  },
  "00000000-0000-4000-8000-000000000002": {
    ru: "Всё тело · B",
    en: "Full body · B",
  },
  "00000000-0000-4000-8000-000000000003": {
    ru: "Домашняя тренировка",
    en: "Home strength",
  },
};
export const templates = (language: Language): Plan[] => [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: templateNames["00000000-0000-4000-8000-000000000001"][language],
    nameTranslations: templateNames["00000000-0000-4000-8000-000000000001"],
    days: [1, 4],
    exerciseIds: ["squat", "bench", "row", "curl"],
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: templateNames["00000000-0000-4000-8000-000000000002"][language],
    nameTranslations: templateNames["00000000-0000-4000-8000-000000000002"],
    days: [2, 5],
    exerciseIds: ["deadlift", "press", "pulldown", "lunge"],
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: templateNames["00000000-0000-4000-8000-000000000003"][language],
    nameTranslations: templateNames["00000000-0000-4000-8000-000000000003"],
    days: [6],
    exerciseIds: ["pushup", "goblet", "row", "lateral"],
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];
export function makeMovement(exerciseId: string, uuid: () => string): Movement {
  const exercise = exercises.find((e) => e.id === exerciseId);
  if (!exercise) throw new Error("Unknown exercise");
  return {
    id: uuid(),
    exerciseId,
    name: exercise.name,
    notes: "",
    sets: Array.from({ length: 3 }, () => ({
      id: uuid(),
      reps: 10,
      weight: 0,
      done: false,
    })),
  };
}
export function makeWorkout(
  name: string,
  exerciseIds: string[],
  uuid: () => string,
  nameTranslations?: { ru: string; en: string },
): Workout {
  return {
    id: uuid(),
    name,
    nameTranslations,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    movements: exerciseIds.map((id) => makeMovement(id, uuid)),
    restEndsAt: null,
    restSeconds: 90,
  };
}
export function demoState(
  uuid: () => string,
  language: Language = "ru",
): LocalState {
  const state = emptyState();
  const settings = {
    ...defaultSettings(language),
    name: language === "ru" ? "Алекс" : "Alex",
  };
  state.records[keyOf("settings", "settings")] = {
    kind: "settings",
    entityId: "settings",
    version: 0,
    sequence: 0,
    data: settings,
  };
  for (const plan of templates(language))
    state.records[keyOf("plan", plan.id)] = {
      kind: "plan",
      entityId: plan.id,
      version: 0,
      sequence: 0,
      data: plan,
    };
  for (let i = 0; i < 9; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (9 - i) * 3);
    date.setHours(18, 0, 0, 0);
    const plan = templates(language)[i % 2];
    const workout = makeWorkout(
      plan.name,
      plan.exerciseIds,
      uuid,
      plan.nameTranslations,
    );
    workout.startedAt = date.toISOString();
    workout.finishedAt = new Date(
      date.getTime() + (42 + i) * 60000,
    ).toISOString();
    workout.movements.forEach((m, j) =>
      m.sets.forEach((s) => {
        s.weight = [40, 30, 25, 8][j] + i * 2.5;
        s.done = true;
      }),
    );
    state.records[keyOf("workout", workout.id)] = {
      kind: "workout",
      entityId: workout.id,
      version: 0,
      sequence: 0,
      data: workout,
    };
  }
  return state;
}
