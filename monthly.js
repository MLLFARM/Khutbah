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

// ======================
// إنشاء التقرير الشهري (بالقالب monthly.pdf)
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

    let settings = JSON.parse(localStorage.getItem("imamSettings")) || {};
    const mosque = settings.mosque || "";
    const location = settings.location || ""; // إذا لم تكن مسجلة ستكون فارغة

    // إعادة تشكيل المصفوفة
    khutab = khutab.map(item => ({
        title: item.title,
        day: Number(item.day),
        month: Number(item.month),
        mosque: mosque,
        location: location
    }));

    // إكمال المصفوفة لتصبح 6 صفوف لتعبئة القالب بشكل صحيح
    while (khutab.length < 6) {
        khutab.push({ title: "", day: "", month: "", mosque: mosque, location: location });
    }

    try {
        // محاولة جلب القالب والخط مع معالجة الأخطاء
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

        // تجهيز بيانات الترويسة
        let year = "1448"; 
        year = arabicNumbers(year.slice(-1));
        const currentMonthName = hijriMonths[currentMonth - 1] || "";

        // رسم الترويسة (وفق الإحداثيات المخصصة في قالبك)
        page.drawText(settings.imamName || "", { x: 350, y: 680, size: 16, font: font });
        page.drawText(arabicNumberPDF(settings.nationalId || ""), { x: 350, y: 652, size: 16, font: font });
        page.drawText(arabicNumberPDF(settings.phone || ""), { x: 87, y: 680, size: 16, font: font });
        page.drawText(currentMonthName, { x: 182, y: 711, size: 16, font: font });
        page.drawText(year, { x: 105, y: 711, size: 18, font: font });

        const rows = [
            { titleY: 612, infoY: 585 },
            { titleY: 516, infoY: 486 },
            { titleY: 420, infoY: 394 },
            { titleY: 324, infoY: 297 },
            { titleY: 228, infoY: 199 },
            { titleY: 132, infoY: 103 } 
        ];

        // تعبئة الصفوف
        khutab.forEach((item, index) => {
            if (index >= 6) return;

            page.drawText(item.title || "", { x: 305, y: rows[index].titleY, size: 16, font: font });

            if (item.day) {
                page.drawText(arabicNumberPDF(item.day), { x: 95, y: rows[index].titleY, size: 16, font: font });
            }

            if (item.month) {
                page.drawText(arabicNumberPDF(item.month), { x: 68, y: rows[index].titleY, size: 16, font: font });
            }

            if (item.title !== "") {
                page.drawText(year, { x: 52, y: rows[index].titleY, size: 16, font: font });
                page.drawText(item.mosque || "", { x: 410, y: rows[index].infoY, size: 16, font: font });
                page.drawText(item.location || "", { x: 230, y: rows[index].infoY, size: 16, font: font });
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