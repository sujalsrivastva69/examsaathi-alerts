import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BriefcaseBusiness } from "lucide-react";
import type { Language } from "../i18n";

type PageSection = { heading: string; paragraphs: string[] };

const content: Record<
  Language,
  Record<string, { title: string; intro: string; sections: PageSection[] }>
> = {
  en: {
    privacy: {
      title: "Privacy Policy",
      intro: "Plain-language beta privacy information — needs legal review before public launch.",
      sections: [
        {
          heading: "Information we use",
          paragraphs: [
            "We use your email address to secure your account and, only when you consent, send vacancy alerts. Your education level, date of birth, state, and job preferences are used to explain possible matches. Your date of birth is compared with the age cutoff date in each official notice.",
            "We do not ask for Aadhaar numbers or document uploads. Do not send sensitive identity documents in feedback.",
          ],
        },
        {
          heading: "Why and how we use it",
          paragraphs: [
            "We use profile data to compare stated vacancy criteria and show matched, not matched, or unknown explanations. A preliminary match is not a finding of eligibility. We use account and service data to operate, secure, troubleshoot, and improve the beta.",
            "We do not sell personal information. Email delivery may involve service providers such as Supabase and Resend to operate the service.",
          ],
        },
        {
          heading: "Your choices and requests",
          paragraphs: [
            "Email alerts are optional and can be turned off in Notification settings or by using the unsubscribe link. You can update your profile and may request account deletion from your profile page.",
            "For privacy questions or a data request, contact the beta operator through the support contact provided when the beta is announced. We will publish a monitored contact before inviting external beta users.",
          ],
        },
        {
          heading: "Retention, security, and legal review",
          paragraphs: [
            "We retain account and matching information while needed to provide the beta and handle security, support, and legal obligations. Feedback may be retained to investigate service quality. Access is limited through application controls and database policies; no online service can promise absolute security.",
            "This draft is DPDP Act-aware product information, not legal advice or a compliance certification. It needs review by qualified Indian privacy counsel, including final purposes, retention periods, grievance contact, processor terms, and applicable commencement/rules, before public launch.",
          ],
        },
      ],
    },
    terms: {
      title: "Terms of Use",
      intro:
        "These draft beta terms explain the service's limits in plain language and need legal review.",
      sections: [
        {
          heading: "Beta service",
          paragraphs: [
            "ExamSaathi Alerts is an experimental information and notification service. Features, data coverage, and availability may change or be interrupted during beta.",
            "You must provide accurate profile information, protect your account, and use the service lawfully. Do not attempt to access another person's information or disrupt the service.",
          ],
        },
        {
          heading: "Not an eligibility decision",
          paragraphs: [
            "A preliminary match or review status is informational only and never guarantees eligibility, shortlisting, selection, or an application outcome. Rules may be incomplete or interpreted differently by the recruiting authority.",
            "The official recruitment notification and recruiting authority's instructions are final. You are responsible for checking the official notice, amendments, age cutoff, category relaxations, application portal, fees, and deadlines, and for submitting your application on time.",
          ],
        },
        {
          heading: "Sources, links, and availability",
          paragraphs: [
            "We aim to link to official sources and show when information was last verified, but cannot guarantee that external pages remain available, current, or error-free. Follow official links before acting.",
            "Beta source coverage is limited. At this time no automated recruitment source is enabled. See About for the sources currently excluded from automated ingestion. A notice appearing in the service does not mean all recruitment authorities or vacancies are covered.",
          ],
        },
        {
          heading: "Updates and contact",
          paragraphs: [
            "We may update these terms as beta features change. Continued use after a posted update means you accept the updated terms. For support, use the contact details announced with the beta; a monitored public support address must be added before invitations are sent.",
          ],
        },
      ],
    },
    about: {
      title: "About ExamSaathi Alerts",
      intro:
        "A beta project to help candidates review government vacancy information, understand preliminary profile matches, and keep track of applications.",
      sections: [
        {
          heading: "What the beta does",
          paragraphs: [
            "Candidates can create a minimal profile, review a transparent checklist against stated vacancy rules, open the official notice, and record application progress. The product aims to provide English and Hindi information and low-bandwidth, mobile-first screens.",
            "The platform does not make eligibility decisions. Unknown or unclear information should be reviewed, and the official notice remains authoritative.",
          ],
        },
        {
          heading: "Recruitment-source coverage",
          paragraphs: [
            "Current automated source coverage: none. The Staff Selection Commission (SSC) source is listed but disabled because permission could not be verified from its robots/terms information. UPSC is not configured because a source request returned HTTP 403; the platform does not bypass blocking.",
            "Vacancies may be reviewed and entered through controlled admin workflows. Inclusion is not comprehensive and does not imply endorsement by any recruiting authority. Check the Coverage and last-verified information on each vacancy and consult the official notice.",
          ],
        },
        {
          heading: "Beta feedback",
          paragraphs: [
            "Signed-in beta users can report a wrong match, a missed vacancy, or an irrelevant alert. Please do not include Aadhaar numbers, passwords, or document scans in feedback.",
          ],
        },
      ],
    },
  },
  hi: {
    privacy: {
      title: "गोपनीयता नीति",
      intro:
        "बीटा के लिए सरल भाषा में गोपनीयता जानकारी — सार्वजनिक लॉन्च से पहले कानूनी समीक्षा आवश्यक।",
      sections: [
        {
          heading: "हम कौन-सी जानकारी लेते हैं",
          paragraphs: [
            "खाते की सुरक्षा और आपकी सहमति होने पर ईमेल अलर्ट भेजने के लिए ईमेल पता इस्तेमाल होता है। शिक्षा, जन्मतिथि, राज्य और नौकरी की पसंद का उपयोग संभावित मिलान समझाने में होता है। जन्मतिथि की तुलना हर आधिकारिक सूचना की आयु-कटऑफ़ तारीख़ से की जाती है।",
            "हम आधार नंबर या दस्तावेज़ अपलोड नहीं माँगते। प्रतिक्रिया में संवेदनशील पहचान दस्तावेज़ न भेजें।",
          ],
        },
        {
          heading: "जानकारी का उपयोग",
          paragraphs: [
            "प्रोफ़ाइल का उपयोग भर्ती में दिए नियमों से तुलना करके मेल, मेल नहीं, या अज्ञात स्थिति समझाने के लिए होता है। प्रारंभिक मिलान पात्रता का निर्णय नहीं है। बीटा चलाने, सुरक्षित रखने, समस्या सुलझाने और सेवा सुधारने के लिए खाते और सेवा संबंधी जानकारी का उपयोग होता है।",
            "हम व्यक्तिगत जानकारी नहीं बेचते। सेवा चलाने के लिए Supabase और Resend जैसे सेवा प्रदाता ईमेल या खाते की जानकारी संसाधित कर सकते हैं।",
          ],
        },
        {
          heading: "आपके विकल्प और अनुरोध",
          paragraphs: [
            "ईमेल अलर्ट वैकल्पिक हैं; इन्हें सूचना सेटिंग या ईमेल के सदस्यता समाप्त लिंक से बंद किया जा सकता है। प्रोफ़ाइल बदली जा सकती है और प्रोफ़ाइल पृष्ठ से खाता हटाने का अनुरोध किया जा सकता है।",
            "गोपनीयता प्रश्न या डेटा अनुरोध के लिए बीटा घोषणा में दिया संपर्क इस्तेमाल करें। बाहरी बीटा उपयोगकर्ताओं को आमंत्रित करने से पहले निगरानी वाला संपर्क प्रकाशित किया जाएगा।",
          ],
        },
        {
          heading: "अवधारण, सुरक्षा और कानूनी समीक्षा",
          paragraphs: [
            "खाते और मिलान की जानकारी बीटा चलाने तथा सुरक्षा, सहायता और कानूनी ज़रूरतों के लिए आवश्यक अवधि तक रखी जाती है। सेवा गुणवत्ता जाँचने के लिए प्रतिक्रिया रखी जा सकती है। पहुँच सीमित करने के लिए एप्लिकेशन नियंत्रण और डेटाबेस नीतियाँ लागू हैं; कोई ऑनलाइन सेवा पूर्ण सुरक्षा की गारंटी नहीं दे सकती।",
            "यह मसौदा DPDP Act को ध्यान में रखकर लिखा गया उत्पाद विवरण है, कानूनी सलाह या अनुपालन प्रमाणपत्र नहीं। सार्वजनिक लॉन्च से पहले भारतीय गोपनीयता कानून विशेषज्ञ से उद्देश्य, अवधारण अवधि, शिकायत संपर्क, प्रदाता शर्तें और लागू नियमों की समीक्षा आवश्यक है।",
          ],
        },
      ],
    },
    terms: {
      title: "उपयोग की शर्तें",
      intro:
        "ये मसौदा बीटा शर्तें सेवा की सीमाएँ सरल भाषा में बताती हैं; कानूनी समीक्षा आवश्यक है।",
      sections: [
        {
          heading: "बीटा सेवा",
          paragraphs: [
            "ExamSaathi Alerts एक प्रयोगात्मक सूचना और अलर्ट सेवा है। बीटा के दौरान सुविधाएँ, डेटा कवरेज और उपलब्धता बदल सकती है या रुक सकती है।",
            "सही प्रोफ़ाइल जानकारी दें, खाते को सुरक्षित रखें और सेवा का वैध उपयोग करें। किसी अन्य व्यक्ति की जानकारी पाने या सेवा बाधित करने की कोशिश न करें।",
          ],
        },
        {
          heading: "यह पात्रता का निर्णय नहीं है",
          paragraphs: [
            "प्रारंभिक मिलान या समीक्षा स्थिति केवल जानकारी है; यह पात्रता, चयन, शॉर्टलिस्ट या आवेदन परिणाम की गारंटी नहीं देती। नियम अधूरे हो सकते हैं या भर्ती प्राधिकरण की व्याख्या अलग हो सकती है।",
            "आधिकारिक भर्ती सूचना और भर्ती प्राधिकरण के निर्देश अंतिम हैं। आधिकारिक सूचना, संशोधन, आयु कटऑफ़, श्रेणी छूट, आवेदन पोर्टल, शुल्क और तारीख़ें जाँचना तथा समय पर आवेदन करना आपकी ज़िम्मेदारी है।",
          ],
        },
        {
          heading: "स्रोत, लिंक और उपलब्धता",
          paragraphs: [
            "हम आधिकारिक स्रोत जोड़ने और अंतिम सत्यापन दिखाने का प्रयास करते हैं, लेकिन बाहरी पृष्ठों की उपलब्धता, नवीनता या त्रुटिरहित होने की गारंटी नहीं दे सकते। कोई कदम उठाने से पहले आधिकारिक लिंक देखें।",
            "बीटा में स्रोत कवरेज सीमित है। अभी कोई स्वचालित भर्ती स्रोत सक्रिय नहीं है। स्वचालित आयात से बाहर स्रोतों के लिए परिचय पृष्ठ देखें। सेवा में कोई सूचना दिखने का अर्थ यह नहीं कि सभी प्राधिकरण या भर्तियाँ शामिल हैं।",
          ],
        },
        {
          heading: "अपडेट और संपर्क",
          paragraphs: [
            "बीटा सुविधाओं के साथ शर्तें बदली जा सकती हैं। प्रकाशित अपडेट के बाद सेवा जारी रखने का अर्थ नई शर्तें स्वीकार करना है। सहायता के लिए बीटा घोषणा में दिए संपर्क का उपयोग करें; निमंत्रण से पहले निगरानी वाला सार्वजनिक सहायता पता जोड़ना आवश्यक है।",
          ],
        },
      ],
    },
    about: {
      title: "ExamSaathi Alerts के बारे में",
      intro:
        "यह बीटा परियोजना सरकारी भर्ती की जानकारी देखने, प्रोफ़ाइल से प्रारंभिक मिलान समझने और आवेदन की स्थिति दर्ज करने में मदद करती है।",
      sections: [
        {
          heading: "बीटा क्या करता है",
          paragraphs: [
            "उम्मीदवार न्यूनतम प्रोफ़ाइल बना सकते हैं, भर्ती के बताए नियमों के विरुद्ध पारदर्शी जाँच देख सकते हैं, आधिकारिक सूचना खोल सकते हैं और आवेदन की प्रगति दर्ज कर सकते हैं। सेवा अंग्रेज़ी और हिंदी तथा मोबाइल और धीमे नेटवर्क के लिए बनाई जा रही है।",
            "प्लेटफ़ॉर्म पात्रता का निर्णय नहीं देता। अज्ञात या अस्पष्ट जानकारी की समीक्षा करें; आधिकारिक सूचना ही अंतिम है।",
          ],
        },
        {
          heading: "भर्ती स्रोतों का कवरेज",
          paragraphs: [
            "मौजूदा स्वचालित स्रोत कवरेज: कोई नहीं। कर्मचारी चयन आयोग (SSC) स्रोत सूची में है, लेकिन robots/terms जानकारी से अनुमति सत्यापित न हो पाने के कारण बंद है। UPSC स्रोत कॉन्फ़िगर नहीं है क्योंकि अनुरोध पर HTTP 403 मिला; प्लेटफ़ॉर्म रोक को पार नहीं करता।",
            "नियंत्रित प्रशासनिक प्रक्रिया से कुछ भर्तियों की समीक्षा और प्रविष्टि हो सकती है। कवरेज संपूर्ण नहीं है और किसी भर्ती प्राधिकरण का समर्थन नहीं दर्शाती। हर भर्ती की कवरेज और अंतिम सत्यापन जानकारी देखें और आधिकारिक सूचना पढ़ें।",
          ],
        },
        {
          heading: "बीटा प्रतिक्रिया",
          paragraphs: [
            "लॉग-इन बीटा उपयोगकर्ता गलत मिलान, छूटी भर्ती या अप्रासंगिक अलर्ट की सूचना दे सकते हैं। प्रतिक्रिया में आधार नंबर, पासवर्ड या दस्तावेज़ स्कैन न दें।",
          ],
        },
      ],
    },
  },
};

export function PublicPage() {
  const { pathname } = useLocation();
  const page = pathname.slice(1);
  const { i18n } = useTranslation();
  const language: Language = i18n.resolvedLanguage?.startsWith("hi") ? "hi" : "en";
  const pageContent = content[language][page] ?? content[language].about;

  return (
    <main lang={language} className="min-h-screen bg-canvas px-4 py-8 text-ink sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
          <Link to="/" className="inline-flex items-center gap-2 font-bold text-forest">
            <BriefcaseBusiness size={19} aria-hidden="true" />
            ExamSaathi Alerts
          </Link>
          <div className="flex gap-3 text-sm font-medium">
            <button
              type="button"
              onClick={() => void i18n.changeLanguage(language === "en" ? "hi" : "en")}
              className="rounded px-2 py-1 text-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            >
              {language === "en" ? "हिन्दी" : "English"}
            </button>
            <Link
              to="/privacy"
              className="rounded px-2 py-1 hover:text-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            >
              {language === "en" ? "Privacy" : "गोपनीयता"}
            </Link>
            <Link
              to="/terms"
              className="rounded px-2 py-1 hover:text-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            >
              {language === "en" ? "Terms" : "शर्तें"}
            </Link>
          </div>
        </header>
        <article className="py-8 sm:py-10">
          <h1 className="text-3xl font-bold tracking-tight">{pageContent.title}</h1>
          <p className="mt-3 text-base leading-7 text-muted">{pageContent.intro}</p>
          <div className="mt-8 space-y-7">
            {pageContent.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg font-bold">{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-2 text-sm leading-7 text-muted">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
          <nav
            className="mt-9 flex flex-wrap gap-3 border-t border-line pt-5 text-sm font-semibold text-forest"
            aria-label={language === "en" ? "More information" : "अधिक जानकारी"}
          >
            <Link to="/privacy">{language === "en" ? "Privacy Policy" : "गोपनीयता नीति"}</Link>
            <Link to="/terms">{language === "en" ? "Terms of Use" : "उपयोग की शर्तें"}</Link>
            <Link to="/about">{language === "en" ? "About and coverage" : "परिचय और कवरेज"}</Link>
          </nav>
        </article>
      </div>
    </main>
  );
}
