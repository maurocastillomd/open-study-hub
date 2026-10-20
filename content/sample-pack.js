// A small sample so a new visitor can try every part of the hub before uploading anything.
// It teaches general study skills and is written for this project. Uploading your own
// sources replaces it.

export const samplePack = {
  title: 'Sample: How to study',
  sample: true,
  domains: [
    {id: 'memory', name: 'Memory and recall', weight: 3},
    {id: 'planning', name: 'Planning your study', weight: 2},
    {id: 'exam', name: 'Exam day skills', weight: 2},
  ],
  lessons: [
    {
      id: 'l-retrieval', domain: 'memory', title: 'Pull it out, don\'t pour it in',
      summary: 'Recalling an answer from memory builds memory faster than reading it again.',
      keyPoints: [
        'Rereading feels productive because the page looks familiar, but familiar is not the same as remembered.',
        'Each time you pull a fact out of memory, the path back to it gets stronger.',
        'Close the book, write or say what you know, then check. The check is where you learn.',
      ],
      visual: {kind: 'cycle', caption: 'One round of retrieval practice', parts: [
        {label: 'Try', detail: 'Answer from memory before you look anything up.'},
        {label: 'Check', detail: 'Compare your answer with the source.'},
        {label: 'Fix', detail: 'Note what you missed and why.'},
        {label: 'Space', detail: 'Come back to it in a few days and try again.'},
      ]},
      body: [
        'Most people study by reading their notes again and again. It feels good because the material starts to look familiar. The exam, though, will not show you the page. It asks you to produce the answer yourself.',
        'Retrieval practice means you test yourself before you feel ready. Flashcards, practice questions and blank-page summaries all count. Getting an answer wrong during practice is useful: it tells you exactly what to fix.',
      ],
    },
    {
      id: 'l-spacing', domain: 'memory', title: 'Space it out',
      summary: 'Short sessions spread over days beat one long session on the same material.',
      keyPoints: [
        'Memory fades fast at first, then more slowly. Each review resets the curve a little flatter.',
        'Review new material after about 1 day, then 3 days, then a week.',
        'This hub schedules your flashcards on that pattern automatically.',
      ],
      visual: {kind: 'steps', caption: 'A spaced review schedule', parts: [
        {label: 'Day 0', detail: 'Learn it.'},
        {label: 'Day 1', detail: 'First review. Expect to have forgotten some.'},
        {label: 'Day 3', detail: 'Second review. Recall is easier.'},
        {label: 'Day 7', detail: 'Third review. Now it sticks.'},
      ]},
      body: [
        'Cramming can work for tomorrow, but most of it is gone a week later. Spacing feels harder because you have partly forgotten the material each time you return. That small struggle is what makes the memory last.',
        'You do not need a perfect schedule. Any gap of a day or more between reviews helps.',
      ],
    },
    {
      id: 'l-plan', domain: 'planning', title: 'Work backward from exam day',
      summary: 'Start from the date, count your real hours, and give weak areas more of them.',
      keyPoints: [
        'Count the days you have and the hours you can really study each day.',
        'Spend more time where your score is low and the exam weight is high.',
        'In the final week, shift from learning new material to practice and review.',
      ],
      visual: {kind: 'layers', caption: 'How the plan is built', parts: [
        {label: 'Exam date', detail: 'Sets how many days you have.'},
        {label: 'Daily hours', detail: 'Sets how much fits in each day.'},
        {label: 'Weak areas', detail: 'The quick check shows where to spend more time.'},
        {label: 'Learning style', detail: 'Changes the mix of reading, pictures and practice.'},
      ]},
      body: [
        'A plan that ignores the calendar becomes a wish list. Start from the exam date and the time you really have, not the time you hope to have.',
        'Mixing two topics in one practice session, called interleaving, feels harder than studying one topic at a time. It also trains you to recognise which idea a question is asking about, which is what the exam tests.',
      ],
    },
    {
      id: 'l-exam', domain: 'exam', title: 'Read the question twice',
      summary: 'Most avoidable errors come from misreading the question, not from missing knowledge.',
      keyPoints: [
        'Find what the question actually asks before you look at the answers.',
        'Cross out answers you can rule out, then compare the ones left.',
        'Flag hard questions and move on. Come back with fresh eyes.',
      ],
      visual: {kind: 'compare', caption: 'Two ways to answer a question', parts: [
        {label: 'Rushed', detail: 'Skims the stem, picks the first answer that sounds right.'},
        {label: 'Careful', detail: 'Names the question type, rules out two answers, then chooses.'},
      ]},
      body: [
        'Words like "most", "first", "except" and "best" change what a question wants. Underline them.',
        'If two answers both look right, ask which one answers the exact question asked. The other is often true but answers a different question.',
      ],
    },
  ],
  questions: [
    {id: 'q1', domain: 'memory', stem: 'Which study method builds long-term memory most effectively?', choices: ['Rereading highlighted notes', 'Testing yourself, then checking answers', 'Copying the textbook word for word', 'Listening to a lecture twice'], answer: 1, explanation: 'Retrieval practice strengthens the path back to a memory. Rereading mostly builds familiarity.'},
    {id: 'q2', domain: 'memory', stem: 'You get a practice question wrong. What is the most useful next step?', choices: ['Skip it so you stay confident', 'Read the explanation and note why you missed it', 'Memorise the letter of the right answer', 'Stop practising for the day'], answer: 1, explanation: 'Errors show exactly what to fix. Understanding why turns a miss into learning.'},
    {id: 'q3', domain: 'memory', stem: 'Which review schedule follows spaced practice?', choices: ['Five reviews the night before', 'Day 1, day 3, then day 7', 'Once, right after learning', 'Only when you feel you have forgotten'], answer: 1, explanation: 'Gaps that widen over time make each review count for more.'},
    {id: 'q4', domain: 'planning', stem: 'Your exam is in 30 days and you can study 1 hour a day. What should set your plan first?', choices: ['The order of chapters in the book', 'The days and hours you really have', 'How a friend is studying', 'The topics you enjoy most'], answer: 1, explanation: 'Start from the real time available, then divide it by priority.'},
    {id: 'q5', domain: 'planning', stem: 'Which area should get the most extra time?', choices: ['High exam weight and low score', 'Low exam weight and high score', 'High exam weight and high score', 'Low exam weight and low score'], answer: 0, explanation: 'Time gives the biggest return where the exam asks a lot and you score low.'},
    {id: 'q6', domain: 'planning', stem: 'What should change in the final week before the exam?', choices: ['Start the hardest new topics', 'Shift toward practice questions and review', 'Stop studying completely', 'Switch to a new textbook'], answer: 1, explanation: 'The last week is for using what you know under exam-like conditions.'},
    {id: 'q7', domain: 'exam', stem: 'A question says "Which is NOT a sign of fatigue?" What is the main risk?', choices: ['Running out of time', 'Missing the word NOT', 'Picking the longest answer', 'Changing your answer later'], answer: 1, explanation: 'Negative wording flips the question. Underline it.'},
    {id: 'q8', domain: 'exam', stem: 'You are stuck on a hard question early in the exam. What is the best move?', choices: ['Keep working until you solve it', 'Flag it, move on, and return later', 'Leave it blank for good', 'Guess and never return'], answer: 1, explanation: 'Moving on protects your time. Later questions sometimes jog your memory.'},
    {id: 'q9', domain: 'exam', stem: 'Two answers both look correct. How do you choose?', choices: ['Pick the one with the most detail', 'Pick the one that answers the exact question asked', 'Pick answer C', 'Pick the first one you read'], answer: 1, explanation: 'A true statement that answers a different question is still wrong.'},
  ],
  flashcards: [
    {id: 'f1', domain: 'memory', front: 'Retrieval practice', back: 'Pulling information out of memory, for example by self-testing, to make it stick.'},
    {id: 'f2', domain: 'memory', front: 'Spacing effect', back: 'Reviews spread over days produce longer-lasting memory than one long session.'},
    {id: 'f3', domain: 'memory', front: 'Why rereading misleads you', back: 'It builds familiarity, which feels like knowing but fades without recall.'},
    {id: 'f4', domain: 'planning', front: 'Interleaving', back: 'Mixing different topics in one session so you practise choosing the right idea.'},
    {id: 'f5', domain: 'planning', front: 'Where extra study time pays most', back: 'Topics with high exam weight and a low current score.'},
    {id: 'f6', domain: 'planning', front: 'Final-week focus', back: 'Practice questions and review, not new material.'},
    {id: 'f7', domain: 'exam', front: 'Words that flip a question', back: 'NOT, EXCEPT, LEAST. Underline them.'},
    {id: 'f8', domain: 'exam', front: 'Stuck on a question?', back: 'Flag it, move on, return later.'},
    {id: 'f9', domain: 'exam', front: 'Two good answers?', back: 'Choose the one that answers the exact question asked.'},
  ],
  sources: [],
};
