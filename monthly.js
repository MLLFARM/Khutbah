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

const hijriMonths = [
    "محرم", "صفر", "ربيع الأول", "ربيع الآخر", 
    "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", 
    "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
];

// ملاحظة: كل من قالب الإفادة الأسبوعية (template.pdf) وقالب التقرير الشهري (monthly.pdf)
// يحتويان على السنة الهجرية ١٤٤٨هـ مطبوعة مسبقاً داخل تصميم القالب نفسه، لذلك لا حاجة
// لرسمها برمجياً. عند استلام قالب جديد من الوزارة لعام هجري مختلف، تُستبدل ملفات
// القوالب فقط دون تعديل هذا الكود.

// ======================
// إنشاء الإفادة الأسبوعية (تعبئة قالب template.pdf الرسمي، لخطبة واحدة)
// ======================
async function generateWeeklyPDF() {
    const title = document.getElementById("khutbahTitle")?.value.trim();
    const day = document.getElementById("khutbahDay")?.value.trim();
    const monthSelect = document.getElementById("khutbahMonth");
    const monthVal = monthSelect?.value;

    if (!title || !day || !monthVal) {
        alert("يرجى تعبئة عنوان الخطبة، اليوم، والشهر في بطاقة (تسجيل خطبة جديدة) أولاً.");
        return;
    }

    const settings = JSON.parse(localStorage.getItem("imamSettings")) || {};
    const khateebType = settings.khateebType || "متعاون"; // "متعاون" أو "رسمي"

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
        page.drawText(arabicNumberPDF(day), { x: 172.8, y: 655.68, size: 14, font });
        page.drawText(arabicNumberPDF(monthVal), { x: 120, y: 655.68, size: 14, font });

        // بيانات الخطيب
        page.drawText(settings.imamName || "", { x: 290, y: 606.72, size: 14, font });
        page.drawText(arabicNumberPDF(settings.phone || ""), { x: 33.6, y: 606.72, size: 14, font });
        page.drawText(arabicNumberPDF(settings.nationalId || ""), { x: 290, y: 582.72, size: 14, font });
        page.drawText(settings.mosque || "", { x: 28.8, y: 582.72, size: 14, font });
        page.drawText(settings.location || "", { x: 290, y: 556.32, size: 14, font });

        // صفته: علامة صح فوق المربع المناسب (متعاون / رسمي)
        if (khateebType === "رسمي") {
            page.drawText("✓", { x: 180, y: 556.32, size: 13, font });
        } else {
            page.drawText("✓", { x: 96, y: 556.32, size: 13, font });
        }

        // عنوان الخطبة
        page.drawText(title, { x: 225.6, y: 532.32, size: 14, font });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `إفادة_أسبوعية_${title}.pdf`;
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
        page.drawText(currentMonthName, { x: 189.6 - (monthNameWidth / 2), y: 711.9, size: 13, font });
        page.drawText(settings.imamName || "", { x: 336, y: 679.68, size: 14, font });
        page.drawText(arabicNumberPDF(settings.phone || ""), { x: 19.2, y: 679.68, size: 14, font });
        page.drawText(arabicNumberPDF(settings.nationalId || ""), { x: 336, y: 655.68, size: 14, font });

        // إحداثيات كل كتلة (كتلة لكل خطبة) — المسافة بين الكتل ثابتة
        const rowA0 = 630.72, rowB0 = 598.08, blockStep = 96;

        khutab.forEach((item, index) => {
            const rowA = rowA0 - (index * blockStep);
            const rowB = rowB0 - (index * blockStep);

            if (item.day) page.drawText(arabicNumberPDF(item.day), { x: 110.4, y: rowA, size: 14, font });
            if (item.month) page.drawText(arabicNumberPDF(item.month), { x: 56.16, y: rowA, size: 14, font });
            if (item.title) {
                page.drawText(item.title, { x: 201.6, y: rowA, size: 14, font });
                page.drawText(mosque, { x: 316.8, y: rowB, size: 14, font });
                page.drawText(location, { x: 196.8, y: rowB, size: 14, font });
            }
        });

        // تصدير الملف
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], {type:"application/pdf"});
        
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `التقرير_الشهري_${currentMonthName}.pdf`;
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

        // الترويسة
        page.drawText("التقرير السنوي لخطب الجمعة", { x: width / 2 - 100, y: yPosition, size: 20, font: regularFont });
        yPosition -= 40;
        
        page.drawText("الخطيب: " + imamName, { x: width - 150, y: yPosition, size: 14, font: regularFont });
        page.drawText("المسجد: " + mosque, { x: 100, y: yPosition, size: 14, font: regularFont });
        yPosition -= 30;

        page.drawLine({
            start: { x: 50, y: yPosition },
            end: { x: width - 50, y: yPosition },
            thickness: 1,
            color: PDFLib.rgb(0.5, 0.5, 0.5),
        });
        yPosition -= 40;

        // طباعة قائمة الخطب
        khutab.forEach((item, index) => {
            // إضافة صفحة جديدة إذا اقتربنا من أسفل الصفحة
            if (yPosition < 50) {
                page = newPdfDoc.addPage([595.28, 841.89]);
                yPosition = height - 50;
            }

            let monthName = hijriMonths[Number(item.month) - 1] || "";
            let formattedIndex = arabicNumberPDF(index + 1);
            let formattedDay = arabicNumberPDF(item.day);
            
            let lineText = (item.title || "بدون عنوان") + " | اليوم: " + formattedDay + " | الشهر: " + monthName + " - " + formattedIndex;

            page.drawText(lineText, { x: 50, y: yPosition, size: 12, font: regularFont, color: PDFLib.rgb(0, 0, 0) });
            yPosition -= 25;
        });

        // تصدير الملف
        const pdfBytes = await newPdfDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "التقرير_السنوي_الشامل.pdf";
        link.click();

    } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء إنشاء التقرير السنوي.");
    }
}