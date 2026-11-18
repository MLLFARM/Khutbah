// ======================
// دوال مساعدة (متاحة لجميع التقارير)
// ======================
function arabicNumbers(text) {
    if (text === undefined || text === null || text === "") return ""; 
    return text.toString().replace(/\d/g, function (d) {
        return "٠١٢٣٤٥٦٧٨٩"[d];
    });
}

function arabicNumberPDF(number) {
    if (number === undefined || number === null || number === "") return ""; 
    return arabicNumbers(number.toString()).split("").reverse().join("");
}

// رسم نص عربي مع تصغير تلقائي للخط إن كان أطول من العرض المتاح، لمنع خروج
// النص (خاصة عناوين الخطب الطويلة) عن حدود خانته في القالب
function drawArabicFitText(page, text, options) {
    const { x, y, maxWidth, font, color, startSize = 14, minSize = 8, align = "right" } = options;
    if (!text) return;

    let size = startSize;
    while (font.widthOfTextAtSize(text, size) > maxWidth && size > minSize) {
        size--;
    }

    const textWidth = font.widthOfTextAtSize(text, size);
    let drawX = x;
    if (align === "center") drawX = x + ((maxWidth - textWidth) / 2);
    else if (align === "right") drawX = x + (maxWidth - textWidth); // يلتصق بالحافة اليمنى لخانته

    page.drawText(text, { x: drawX, y, size, font, color: color || undefined });
}

const hijriMonths = [
    "محرم", "صفر", "ربيع الأول", "ربيع الآخر", 
    "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", 
    "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
];

// ملاحظة: كل من قالب الإفادة الأسبوعية (template.pdf) وقالب التقرير الشهري (monthly.pdf)
// يحتويان على السنة الهجرية ١٤٤٨هـ مطبوعة مسبقاً داخل تصميم القالب نفسه، لذلك لا حاجة
// لرسمها برمجياً. عند استلام قالب جديد من الوزارة لعام هجري مختلف، تُستبدل ملفات
// القوالب فقط دون تعديل هذا الكود.

// السنة الهجرية تُستخدم في أسماء الملفات وعنوان التقرير السنوي فقط (ثابتة حسب قوالب الوزارة)
const HIJRI_YEAR = "1448";

// تنظيف النص ليصلح اسم ملف (يحذف الرموز الممنوعة في أسماء الملفات)
function safeFileName(text) {
    return String(text).replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

// ======================
// إنشاء الإفادة الأسبوعية (تعبئة قالب template.pdf الرسمي، لخطبة واحدة)
// ======================
async function generateWeeklyPDF(overrideTitle, overrideDay, overrideMonth) {
    const title = overrideTitle ?? document.getElementById("khutbahTitle")?.value.trim();
    const day = (overrideDay ?? document.getElementById("khutbahDay")?.value)?.toString().trim();
    const monthSelect = document.getElementById("khutbahMonth");
    const monthVal = (overrideMonth ?? monthSelect?.value)?.toString();

    if (!title || !day || !monthVal) {
        alert("يرجى تعبئة عنوان الخطبة، اليوم، والشهر في بطاقة (تسجيل خطبة جديدة) أولاً.");
        return;
    }

    try {
        let existingPdfBytes, fontBytes;
        try {
            existingPdfBytes = await fetch("template.pdf").then(res => {
                if (!res.ok) throw new Error("القالب غير موجود");
                return res.arrayBuffer();
            });
            fontBytes = await fetch("TRADO.TTF").then(res => {
                if (!res.ok) throw new Error("الخط غير موجود");
                return res.arrayBuffer();
            });
        } catch (fetchError) {
            alert("خطأ: يرجى التأكد من وجود ملفي (template.pdf) و (TRADO.TTF) في نفس المجلد.");
            console.error(fetchError);
            return;
        }

        const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
        pdfDoc.registerFontkit(fontkit);
        const page = pdfDoc.getPages()[0];
        const font = await pdfDoc.embedFont(fontBytes);

        // تاريخ الإفادة (اليوم/الشهر من نفس بيانات الخطبة، والسنة مطبوعة مسبقاً في القالب)
        page.drawText(arabicNumberPDF(day), { x: 175.8, y: 661.68, size: 18, font });
        page.drawText(arabicNumberPDF(monthVal), { x: 141, y: 661.68, size: 18, font });

        // الاسم والهوية والجوال والمسجد والموقع وعلامة (متعاون) مطبوعة مسبقاً في القالب

        // عنوان الخطبة
        drawArabicFitText(page, title, { x: 277, y: 507.68, maxWidth: 170, font, startSize: 16, minSize: 7, align: "right" });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = safeFileName(`خطبة الجمعة ${Number(day)}-${Number(monthVal)}-${HIJRI_YEAR}هـ ${title}`) + ".pdf";
        link.click();

    } catch (e) {
        console.error(e);
        alert("حدث خطأ أثناء تصدير الإفادة الأسبوعية.");
    }
}

// ======================
// إنشاء التقرير الشهري (بالقالب monthly.pdf — قالب الوزارة الجديد بـ 6 كتل)
// ======================
async function createMonthlyPDFReport(monthVal) {
    // جلب رقم الشهر (إما من المرر للدالة أو من الواجهة)
    const currentMonth = Number(monthVal || document.getElementById("cardMonth")?.value);

    if (!currentMonth) {
        alert("فضلاً أدخل شهر التقرير في الخانة المخصصة.");
        return;
    }

    let khutab = JSON.parse(localStorage.getItem("khutbahs")) || [];

    if (khutab.length === 0) {
        alert("لا توجد خطب محفوظة في الأرشيف لإصدار التقرير.");
        return;
    }

    // تصفية وترتيب الخطب
    khutab = khutab.filter(item => Number(item.month) === currentMonth);
    khutab.sort((a, b) => Number(a.day) - Number(b.day));

    if (khutab.length === 0) {
        alert("لا توجد خطب مسجلة لهذا الشهر تحديداً.");
        return;
    }

    if (khutab.length > 6) {
        alert(`تنبيه: يوجد ${khutab.length} خطب مسجلة لهذا الشهر، لكن القالب يستوعب 6 فقط كحد أقصى. سيتم عرض أول 6 خطب فقط.`);
    }

    let settings = JSON.parse(localStorage.getItem("imamSettings")) || {};
    const mosque = settings.mosque || "";
    const location = settings.location || "";

    // إعادة تشكيل المصفوفة وإكمالها لتصبح 6 صفوف لتعبئة القالب بشكل صحيح
    khutab = khutab.slice(0, 6).map(item => ({
        title: item.title,
        day: Number(item.day),
        month: Number(item.month),
    }));
    while (khutab.length < 6) {
        khutab.push({ title: "", day: "", month: "" });
    }

    try {
        let existingPdfBytes, fontBytes;
        try {
            existingPdfBytes = await fetch("monthly.pdf").then(res => {
                if (!res.ok) throw new Error("القالب غير موجود");
                return res.arrayBuffer();
            });
            fontBytes = await fetch("TRADO.TTF").then(res => {
                if (!res.ok) throw new Error("الخط غير موجود");
                return res.arrayBuffer();
            });
        } catch (fetchError) {
            alert("خطأ: يرجى التأكد من وجود ملفي (monthly.pdf) و (TRADO.TTF) في نفس المجلد.");
            console.error(fetchError);
            return;
        }

        const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
        pdfDoc.registerFontkit(fontkit);

        const page = pdfDoc.getPages()[0];
        const font = await pdfDoc.embedFont(fontBytes);

        const currentMonthName = hijriMonths[currentMonth - 1] || "";

        // ترويسة الصفحة (السنة الهجرية مطبوعة مسبقاً في القالب، لا حاجة لرسمها)
        const monthNameWidth = font.widthOfTextAtSize(currentMonthName, 13);
        page.drawText(currentMonthName, { x: 194.6 - (monthNameWidth / 2), y: 711.9, size: 16, font });
        page.drawText(settings.imamName || "", { x: 336, y: 679.68, size: 14, font });
        page.drawText(arabicNumberPDF(settings.phone || ""), { x: 73.2, y: 679.68, size: 14, font });
        page.drawText(arabicNumberPDF(settings.nationalId || ""), { x: 336, y: 655.68, size: 14, font });

        // إحداثيات كل كتلة (كتلة لكل خطبة) — المسافة بين الكتل ثابتة
        const rowA0 = 612.5, rowB0 = 590, blockStep = 96;

        khutab.forEach((item, index) => {
            const rowA = rowA0 - (index * blockStep);
            const rowB = rowB0 - (index * blockStep);

            if (item.day) page.drawText(arabicNumberPDF(item.day), { x: 96.4, y: rowA, size: 14, font });
            if (item.month) page.drawText(arabicNumberPDF(item.month), { x: 68.16, y: rowA, size: 14, font });
            if (item.title) {
                drawArabicFitText(page, item.title, { x: 173.8, y: rowA, maxWidth: 255, font, startSize: 14, minSize: 8, align: "right" });
                drawArabicFitText(page, mosque, { x: 385, y: rowB, maxWidth: 100, font, startSize: 14, minSize: 7, align: "center" });
                drawArabicFitText(page, location, { x: 199, y: rowB, maxWidth: 90, font, startSize: 14, minSize: 7, align: "center" });
            }
        });

        // تصدير الملف
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], {type:"application/pdf"});
        
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `خطب شهر ${currentMonthName} لعام ${HIJRI_YEAR}هـ.pdf`;
        link.click();

    } catch (e) {
        console.error(e);
        alert("حدث خطأ غير متوقع أثناء معالجة ملف الـ PDF.");
    }
}

// ======================
// إنشاء التقرير السنوي الشامل (PDF)
// ======================
async function createAnnualPDF() {
    let khutab = JSON.parse(localStorage.getItem("khutbahs")) || [];

    if (khutab.length === 0) {
        alert("لا توجد خطب محفوظة في الأرشيف لإنشاء التقرير السنوي.");
        return;
    }

    // ترتيب الخطب حسب الشهر ثم اليوم
    khutab.sort((a, b) => {
        if (Number(a.month) !== Number(b.month)) {
            return Number(a.month) - Number(b.month);
        }
        return Number(a.day) - Number(b.day);
    });

    let settings = JSON.parse(localStorage.getItem("imamSettings")) || {};
    let imamName = settings.imamName || "غير محدد";
    let mosque = settings.mosque || "غير محدد";

    try {
        const newPdfDoc = await PDFLib.PDFDocument.create();
        newPdfDoc.registerFontkit(fontkit);

        let regularFont;
        try {
            const fontBytes = await fetch("TRADO.TTF").then(res => {
                if (!res.ok) throw new Error();
                return res.arrayBuffer();
            });
            regularFont = await newPdfDoc.embedFont(fontBytes);
        } catch (e) {
            // جلب خط كايرو أونلاين كبديل آمن يدعم العربية في حال فشل TRADO.TTF
            const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/Cairo%5Bwght%5D.ttf';
            const fallbackBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
            regularFont = await newPdfDoc.embedFont(fallbackBytes);
        }

        let page = newPdfDoc.addPage([595.28, 841.89]); 
        let { width, height } = page.getSize();
        
        let yPosition = height - 50;
        const rightEdge = width - 50;   // الحافة اليمنى (هامش النص العربي)
        const leftEdge = 50;
        const black = PDFLib.rgb(0, 0, 0);

        // نص ملتصق بالحافة اليمنى (اتجاه عربي من اليمين لليسار)
        const drawRight = (pg, text, rEdge, y, size) => {
            const w = regularFont.widthOfTextAtSize(text, size);
            pg.drawText(text, { x: rEdge - w, y, size, font: regularFont, color: black });
        };

        // الترويسة: التقرير السنوي لخطب الجمعة لعام 1448هـ (الأجزاء مرتبة من اليمين لليسار)
        const headA = "التقرير السنوي لخطب الجمعة لعام";
        const headB = HIJRI_YEAR;
        const headC = "هـ";
        const headSize = 20, headGap = 5;
        const wA = regularFont.widthOfTextAtSize(headA, headSize);
        const wB = regularFont.widthOfTextAtSize(headB, headSize);
        const wC = regularFont.widthOfTextAtSize(headC, headSize);
        const headRight = (width + wA + wB + wC + headGap * 2) / 2;
        const xA = headRight - wA;
        const xB = xA - headGap - wB;
        const xC = xB - headGap - wC;
        page.drawText(headA, { x: xA, y: yPosition, size: headSize, font: regularFont, color: black });
        page.drawText(headB, { x: xB, y: yPosition, size: headSize, font: regularFont, color: black });
        page.drawText(headC, { x: xC, y: yPosition, size: headSize, font: regularFont, color: black });
        yPosition -= 40;

        // الخطيب على اليمين ثم المسجد نحو اليسار
        drawRight(page, "الخطيب: " + imamName, rightEdge, yPosition, 14);
        drawRight(page, "المسجد: " + mosque, width / 2 - 10, yPosition, 14);
        yPosition -= 30;

        page.drawLine({
            start: { x: leftEdge, y: yPosition },
            end: { x: rightEdge, y: yPosition },
            thickness: 1,
            color: PDFLib.rgb(0.5, 0.5, 0.5),
        });
        yPosition -= 30;

        // أعمدة الجدول من اليمين: م | عنوان الخطبة | اليوم
        const idxRight = rightEdge;
        const titleRight = rightEdge - 35;
        const titleMax = 290;
        const dayRight = titleRight - titleMax - 15;

        // صفحة جديدة إن لم يتسع المكان المتبقي
        const ensureSpace = (needed) => {
            if (yPosition - needed < 50) {
                page = newPdfDoc.addPage([595.28, 841.89]);
                yPosition = height - 50;
            }
        };

        // كل شهر على حدة: من محرم إلى ذي الحجة (تُعرض الأشهر التي فيها خطب فقط)
        for (let m = 1; m <= 12; m++) {
            const monthItems = khutab.filter(k => Number(k.month) === m);
            if (monthItems.length === 0) continue;

            ensureSpace(90);

            // شريط عنوان الشهر
            page.drawRectangle({
                x: leftEdge, y: yPosition - 7,
                width: rightEdge - leftEdge, height: 26,
                color: PDFLib.rgb(0.89, 0.95, 0.91),
            });
            drawRight(page, "شهر " + hijriMonths[m - 1], rightEdge - 8, yPosition, 14);
            yPosition -= 30;

            drawRight(page, "م", idxRight, yPosition, 12);
            drawRight(page, "عنوان الخطبة", titleRight, yPosition, 12);
            drawRight(page, "اليوم", dayRight, yPosition, 12);
            yPosition -= 22;

            monthItems.forEach((item, index) => {
                ensureSpace(25);

                drawRight(page, arabicNumberPDF(index + 1), idxRight, yPosition, 12);
                drawArabicFitText(page, item.title || "بدون عنوان", { x: titleRight - titleMax, y: yPosition, maxWidth: titleMax, font: regularFont, color: black, startSize: 12, minSize: 8, align: "right" });
                drawRight(page, arabicNumberPDF(item.day), dayRight, yPosition, 12);
                yPosition -= 24;
            });

            yPosition -= 16; // فاصل بين الأشهر
        }

        // تصدير الملف
        const pdfBytes = await newPdfDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `التقرير السنوي لخطب الجمعة لعام ${HIJRI_YEAR}هـ.pdf`;
        link.click();

    } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء إنشاء التقرير السنوي.");
    }
}
