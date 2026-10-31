import React, { useState, useMemo } from "react";
import {
  Wand2,
  Loader2,
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  MapPin,
  Users,
  DollarSign,
  Smartphone,
  Image as ImageIcon,
  FileSpreadsheet,
  Code2,
  ExternalLink,
  Sparkles,
  ThumbsUp,
  MessageCircle,
  Share2,
  Heart,
  Send,
  Bookmark,
  Phone,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import {
  RsaCampaign,
  FacebookCampaignConfig,
  FacebookAdCreative,
  MetaCtaType,
  DEFAULT_FACEBOOK_CONFIG,
} from "../data/tidyUpPresets";

interface FacebookAdsStudioProps {
  campaign: RsaCampaign;
  onUpdateCampaignMeta: (updates: Partial<RsaCampaign>) => void;
  onOpenImageStudio: () => void;
  onOpenLaunchTab: () => void;
}

const META_CTA_LABELS: Record<MetaCtaType, string> = {
  BOOK_NOW: "Book Now",
  GET_QUOTE: "Get Quote",
  CALL_NOW: "Call Now",
  SEND_MESSAGE: "Send Message",
  LEARN_MORE: "Learn More",
};

export function buildMetaAdsManagerCsv(campaign: RsaCampaign): string {
  const fb = campaign.facebookConfig || DEFAULT_FACEBOOK_CONFIG;
  const headers = [
    "Campaign Name",
    "Campaign Objective",
    "Campaign Daily Budget",
    "Ad Set Name",
    "Ad Set Run Status",
    "Locations",
    "Radius (km)",
    "Age Min",
    "Age Max",
    "Detailed Targeting Interests",
    "Ad Name",
    "Ad Status",
    "Primary Text",
    "Headline",
    "Link Description",
    "Call to Action",
    "Website URL",
    "Display Link",
    "Privacy Policy URL",
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = fb.ads.map((ad) => [
    fb.campaignName,
    fb.objective,
    fb.dailyBudgetCad,
    fb.adSetName,
    campaign.adStatus === "ENABLED" ? "ACTIVE" : "PAUSED",
    fb.locations.join("; "),
    fb.radiusKm,
    fb.ageMin,
    fb.ageMax,
    fb.interests.join("; "),
    ad.variationName,
    campaign.adStatus === "ENABLED" ? "ACTIVE" : "PAUSED",
    ad.primaryText,
    ad.headline,
    ad.linkDescription,
    ad.ctaType,
    ad.destinationUrl || campaign.finalUrl,
    ad.displayLink || "app.tidyupscleaning.com",
    fb.privacyPolicyUrl || "https://ads.tidyupscleaning.com/privacy",
  ]);

  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) => r.map(escapeCsv).join(",")),
  ].join("\n");
}

export function buildMetaMarketingApiPayload(campaign: RsaCampaign) {
  const fb = campaign.facebookConfig || DEFAULT_FACEBOOK_CONFIG;
  return {
    apiVersion: "v21.0",
    accountContext: {
      businessName: "TidyUps Cleaning",
      phoneNumber: campaign.phoneNumber || "587-742-2500",
      bookingUrl: campaign.finalUrl,
      privacyPolicyUrl:
        fb.privacyPolicyUrl || "https://ads.tidyupscleaning.com/privacy",
    },
    campaign: {
      name: fb.campaignName,
      objective: fb.objective,
      status: campaign.adStatus === "ENABLED" ? "ACTIVE" : "PAUSED",
      special_ad_categories: ["NONE"],
    },
    adSet: {
      name: fb.adSetName,
      daily_budget: Math.round(fb.dailyBudgetCad * 100), // in cents
      billing_event: "IMPRESSIONS",
      optimization_goal:
        fb.conversionLocation === "CALLS" ? "QUALITY_CALL" : "LEAD_GENERATION",
      destination_type: fb.conversionLocation,
      targeting: {
        geo_locations: {
          custom_locations: fb.locations.map((loc) => ({
            address_string: loc,
            radius: fb.radiusKm,
            distance_unit: "kilometer",
          })),
        },
        age_min: fb.ageMin,
        age_max: fb.ageMax,
        flexible_spec: [
          {
            interests: fb.interests.map((interest, idx) => ({
              id: `6003${idx}94821`,
              name: interest,
            })),
          },
        ],
        publisher_platforms: ["facebook", "instagram"],
        facebook_positions: ["feed", "marketplace", "story", "facebook_reels"],
        instagram_positions: ["stream", "story", "reels"],
      },
    },
    instantLeadForm: {
      name: `TidyUps Cleaning — ${campaign.location} Instant Quote Form`,
      privacy_policy: {
        url: fb.privacyPolicyUrl || "https://ads.tidyupscleaning.com/privacy",
        link_text: "TidyUps Cleaning Privacy Policy",
      },
      questions: fb.leadFormQuestions.map((q) => ({
        type: "CUSTOM",
        label: q,
      })),
      thank_you_page: {
        title: "Thank You! Your TidyUps Cleaning Quote Is Being Prepared",
        body: `Need immediate service? Call us directly at ${
          campaign.phoneNumber || "587-742-2500"
        } or book online in 60 seconds.`,
        button_text: "Book Online Now",
        button_type: "VIEW_WEBSITE",
        website_url: campaign.finalUrl,
      },
    },
    creatives: fb.ads.map((ad) => ({
      name: ad.variationName,
      angle: ad.angle,
      object_story_spec: {
        link_data: {
          message: ad.primaryText,
          link: ad.destinationUrl || campaign.finalUrl,
          name: ad.headline,
          description: ad.linkDescription,
          caption: ad.displayLink || "app.tidyupscleaning.com",
          call_to_action: {
            type: ad.ctaType,
            value: {
              link: ad.destinationUrl || campaign.finalUrl,
            },
          },
        },
      },
    })),
  };
}

export const FacebookAdsStudio: React.FC<FacebookAdsStudioProps> = ({
  campaign,
  onUpdateCampaignMeta,
  onOpenImageStudio,
  onOpenLaunchTab,
}) => {
  const fbConfig: FacebookCampaignConfig =
    campaign.facebookConfig || DEFAULT_FACEBOOK_CONFIG;

  const [selectedAdIndex, setSelectedAdIndex] = useState(0);
  const [previewPlacement, setPreviewPlacement] = useState<
    "facebook_feed" | "instagram_feed" | "stories_reels" | "lead_form"
  >("facebook_feed");

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedPixel, setCopiedPixel] = useState(false);
  const [syncedFromRsa, setSyncedFromRsa] = useState(false);

  const [newInterestInput, setNewInterestInput] = useState("");
  const [newLocationInput, setNewLocationInput] = useState("");
  const [newQuestionInput, setNewQuestionInput] = useState("");

  const activeAd: FacebookAdCreative =
    fbConfig.ads[selectedAdIndex] || fbConfig.ads[0];

  const updateFbConfig = (updates: Partial<FacebookCampaignConfig>) => {
    onUpdateCampaignMeta({
      facebookConfig: {
        ...fbConfig,
        ...updates,
      },
    });
  };

  const updateActiveAd = (updates: Partial<FacebookAdCreative>) => {
    const nextAds = fbConfig.ads.map((ad, idx) =>
      idx === selectedAdIndex ? { ...ad, ...updates } : ad
    );
    updateFbConfig({ ads: nextAds });
  };

  // Sync from Google RSA Headlines, 5 Descriptions, Phone & Location
  const handleSyncFromGoogleRsa = () => {
    const phone = campaign.phoneNumber || "587-742-2500";
    const loc = campaign.location || "Edmonton & South Edmonton";
    const d1 =
      campaign.descriptions[0]?.text ||
      "Moving out? Leave the cleaning to Tidyups. Get your Edmonton move-out quote today.";
    const d2 =
      campaign.descriptions[1]?.text ||
      "Built-up dirt and grime? Our deep cleaning gives your home a fresh start. Book today.";
    const d3 =
      campaign.descriptions[2]?.text ||
      "Make moving easier with thorough kitchen, bathroom and floor cleaning. Get a quote.";
    const d4 =
      campaign.descriptions[3]?.text ||
      "From baseboards to bathroom buildup, we handle the details. Book your deep clean.";
    const d5 =
      campaign.descriptions[4]?.text ||
      `Need move-out or deep cleaning in ${loc}? Call Tidyups at ${phone} today.`;

    const h1 = (campaign.headlines[0]?.text || `Move Out Cleaning ${loc}`).slice(
      0,
      40
    );
    const h2 = (campaign.headlines[1]?.text || `Deep Cleaning ${loc}`).slice(
      0,
      40
    );

    const syncedAds: FacebookAdCreative[] = [
      {
        id: `fb-sync-1-${Date.now()}`,
        variationName: "Ad 1: Move-Out & End of Tenancy Inspection Clean",
        angle: "Synced from Google RSA Move-Out Copy",
        primaryText: `${d1}\n\n${d3}\n✅ Inside oven, fridge, cabinets & drawers\n✅ Spotless baseboards, bathrooms & floors\n✅ Serving ${loc}\n\n📲 Book online in 60 seconds at ${campaign.finalUrl} or call ${phone}!`,
        headline: h1,
        linkDescription: `Call ${phone} or Book Online`.slice(0, 30),
        ctaType: "GET_QUOTE",
        destinationUrl: campaign.finalUrl,
        displayLink: "app.tidyupscleaning.com",
        promoBadge: "100% Inspection Ready",
        imageUrl: activeAd?.imageUrl || campaign.attachedImageUrl,
      },
      {
        id: `fb-sync-2-${Date.now()}`,
        variationName: "Ad 2: Full Home Deep Cleaning Reset",
        angle: "Synced from Google RSA Deep Clean Copy",
        primaryText: `${d2}\n\n${d4}\n✨ Hand-wiped baseboards, trim & doors\n✨ Tough kitchen grease & bathroom buildup gone\n✨ Trusted ${loc} residential cleaners\n\nTap 'Book Now' for your instant quote or call ${phone} today!`,
        headline: h2,
        linkDescription: `${loc} Deep Clean`.slice(0, 30),
        ctaType: "BOOK_NOW",
        destinationUrl: campaign.finalUrl,
        displayLink: "app.tidyupscleaning.com",
        promoBadge: "Fresh Start Deep Clean",
        imageUrl: activeAd?.imageUrl || campaign.attachedImageUrl,
      },
      {
        id: `fb-sync-3-${Date.now()}`,
        variationName: `Ad 3: Direct Call / Fast Quote (${phone})`,
        angle: "Synced from Google RSA Direct Call CTA",
        primaryText: `${d5}\n\n• House, Condo & Apartment Move-Out Cleaning\n• End of Tenancy & Landlord Checklist Coverage\n• Top-to-Bottom Deep House Cleaning\n\n📞 Call TidyUps at ${phone} or book online at ${campaign.finalUrl}`,
        headline: `Call TidyUps: ${phone}`.slice(0, 40),
        linkDescription: "Instant 60-Second Online Quote",
        ctaType: "CALL_NOW",
        destinationUrl: campaign.finalUrl,
        displayLink: "app.tidyupscleaning.com",
        promoBadge: "Openings This Week",
        imageUrl: activeAd?.imageUrl || campaign.attachedImageUrl,
      },
    ];

    updateFbConfig({
      campaignName: `Meta Leads - TidyUps ${loc} - Move-Out & Deep Clean`,
      adSetName: `${loc} +${fbConfig.radiusKm}km | Homeowners & Movers`,
      ads: syncedAds,
    });
    setSelectedAdIndex(0);
    setSyncedFromRsa(true);
    setTimeout(() => setSyncedFromRsa(false), 2500);
  };

  // AI Generate 3 Meta Ad Creatives
  const handleGenerateWithAi = async () => {
    setIsGeneratingAi(true);
    setAiError(null);
    try {
      const res = await fetch("/api/facebook-ads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: campaign.serviceType,
          location: campaign.location,
          phoneNumber: campaign.phoneNumber || "587-742-2500",
          finalUrl: campaign.finalUrl,
          promoOffer: campaign.promoOffer,
          targetKeywords: campaign.targetKeywords,
          descriptions: campaign.descriptions.map((d) => d.text),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(
          data.error || "Failed to generate Facebook & Instagram ads."
        );
      }

      const validCtas: MetaCtaType[] = [
        "BOOK_NOW",
        "GET_QUOTE",
        "CALL_NOW",
        "SEND_MESSAGE",
        "LEARN_MORE",
      ];

      const generatedAds: FacebookAdCreative[] = (data.ads || [])
        .slice(0, 4)
        .map((ad: any, i: number) => ({
          id: `fb-ai-${Date.now()}-${i}`,
          variationName: String(
            ad.variationName || `Ad Variation #${i + 1}`
          ).trim(),
          angle: String(ad.angle || "Local Cleaning Offer").trim(),
          primaryText: String(ad.primaryText || "").trim(),
          headline: String(ad.headline || "TidyUps Cleaning Edmonton")
            .trim()
            .slice(0, 40),
          linkDescription: String(
            ad.linkDescription || `Call ${campaign.phoneNumber || "587-742-2500"}`
          )
            .trim()
            .slice(0, 30),
          ctaType: validCtas.includes(ad.ctaType) ? ad.ctaType : "BOOK_NOW",
          destinationUrl: campaign.finalUrl,
          displayLink: "app.tidyupscleaning.com",
          promoBadge: String(ad.promoBadge || "Book in 60 Seconds")
            .trim()
            .slice(0, 24),
          imageUrl: activeAd?.imageUrl || campaign.attachedImageUrl,
        }));

      updateFbConfig({
        campaignName: data.campaignName || fbConfig.campaignName,
        adSetName: data.adSetName || fbConfig.adSetName,
        interests:
          Array.isArray(data.suggestedInterests) &&
          data.suggestedInterests.length > 0
            ? data.suggestedInterests
            : fbConfig.interests,
        ads: generatedAds.length > 0 ? generatedAds : fbConfig.ads,
      });
      setSelectedAdIndex(0);
    } catch (err: any) {
      setAiError(
        err?.message || "Could not generate Meta ads. Please try again."
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const metaCsvContent = useMemo(
    () => buildMetaAdsManagerCsv(campaign),
    [campaign]
  );

  const metaApiPayload = useMemo(
    () => buildMetaMarketingApiPayload(campaign),
    [campaign]
  );

  const handleDownloadMetaCsv = () => {
    const blob = new Blob([metaCsvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tidyups-facebook-instagram-ads-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const metaPixelSnippet = `<!-- Meta Pixel Code for TidyUps Cleaning (${campaign.location}) -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${fbConfig.metaPixelId || "YOUR_PIXEL_ID"}');
fbq('track', 'PageView');
fbq('track', 'Lead', { content_name: 'TidyUps Cleaning Quote', currency: 'CAD', value: ${fbConfig.dailyBudgetCad} });
</script>`;

  const previewImageUrl =
    activeAd?.imageUrl ||
    campaign.attachedImageUrl ||
    campaign.generatedImages?.[0]?.imageUrl ||
    null;

  const monthlyMetaBudget = Math.round(fbConfig.dailyBudgetCad * 30.4);
  const estDailyReachMin = Math.round(fbConfig.dailyBudgetCad * 45);
  const estDailyReachMax = Math.round(fbConfig.dailyBudgetCad * 110);

  return (
    <div className="space-y-6">
      {/* Top Hero Banner: Unified Google + Facebook/Instagram Strategy */}
      <div className="bg-[#120e17] border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full brand-gradient text-white">
                <Sparkles className="w-3.5 h-3.5" />
                Facebook &amp; Instagram (Meta) Ads Studio
              </span>
              <span className="text-xs font-mono text-[#a899b3]">
                Synced with Google RSA · Phone:{" "}
                <strong className="text-white">
                  {campaign.phoneNumber || "587-742-2500"}
                </strong>{" "}
                · Privacy URL:{" "}
                <strong className="text-[#ec4899]">
                  ads.tidyupscleaning.com/privacy
                </strong>
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-white mt-1">
              Build High-Converting Facebook Feed, Instagram &amp; Story/Reel Ads for{" "}
              {campaign.location || "Edmonton"}
            </h2>
            <p className="text-xs text-[#a899b3] max-w-3xl">
              Generate scroll-stopping social copy, configure your{" "}
              <strong>{campaign.location || "Edmonton"} +{fbConfig.radiusKm}km</strong>{" "}
              local radius targeting and <strong>Meta Instant Lead Form</strong>{" "}
              (pre-linked to <code className="font-mono">/privacy</code>),
              attach AI interior cleaning photos, and export directly to{" "}
              <strong>Meta Ads Manager CSV</strong> or your{" "}
              <strong>6-Tab Color-Coded Google Sheet</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSyncFromGoogleRsa}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {syncedFromRsa ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Synced from Google RSA!
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-[#ec4899]" />
                  1-Click Sync from Google RSA
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleGenerateWithAi}
              disabled={isGeneratingAi}
              className="px-4 py-2 text-xs font-bold rounded-full brand-gradient text-white disabled:opacity-60 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 shadow-md"
            >
              {isGeneratingAi ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating 3 Meta Ads...
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  AI Generate 3 FB &amp; IG Ads
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadMetaCsv}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export Meta Ads CSV
            </button>
          </div>
        </div>

        {aiError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200">
            {aiError}
          </div>
        )}
      </div>

      {/* Main 2-Column Workspace: Left (7 cols) Editor + Targeting | Right (5 cols) Live Feed/Story/Lead Form Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Ad Variations Selector & Copy Editor */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  1. Facebook &amp; Instagram Ad Creative Variations ({fbConfig.ads.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Test multiple hooks (Move-Out Inspection, Deep Clean Reset, and Direct Call {campaign.phoneNumber || "587-742-2500"})
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const newAd: FacebookAdCreative = {
                    id: `fb-custom-${Date.now()}`,
                    variationName: `Ad ${fbConfig.ads.length + 1}: Custom ${campaign.location} Angle`,
                    angle: "Local Homeowner Special",
                    primaryText: `Looking for reliable move-out or deep house cleaning in ${campaign.location}? ✨\n\n✅ Thorough kitchens, bathrooms, baseboards & floors\n✅ Upfront flat-rate pricing & 100% satisfaction guarantee\n\n📲 Book online at ${campaign.finalUrl} or call TidyUps at ${campaign.phoneNumber || "587-742-2500"}!`,
                    headline: `Book ${campaign.location} Cleaning Today`.slice(
                      0,
                      40
                    ),
                    linkDescription: `Call ${
                      campaign.phoneNumber || "587-742-2500"
                    }`,
                    ctaType: "BOOK_NOW",
                    destinationUrl: campaign.finalUrl,
                    displayLink: "app.tidyupscleaning.com",
                    promoBadge: "Book Online in 60s",
                  };
                  updateFbConfig({ ads: [...fbConfig.ads, newAd] });
                  setSelectedAdIndex(fbConfig.ads.length);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Ad Variation
              </button>
            </div>

            {/* Variation Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {fbConfig.ads.map((ad, idx) => (
                <button
                  key={ad.id}
                  type="button"
                  onClick={() => setSelectedAdIndex(idx)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-left ${
                    selectedAdIndex === idx
                      ? "brand-gradient text-white border-transparent shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div>{ad.variationName}</div>
                  <div
                    className={`text-[10px] font-normal mt-0.5 ${
                      selectedAdIndex === idx
                        ? "text-white/90"
                        : "text-slate-500"
                    }`}
                  >
                    {ad.angle} · CTA: {META_CTA_LABELS[ad.ctaType]}
                  </div>
                </button>
              ))}
            </div>

            {activeAd && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Variation Name
                    </label>
                    <input
                      type="text"
                      value={activeAd.variationName}
                      onChange={(e) =>
                        updateActiveAd({ variationName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      CTA Button Type
                    </label>
                    <select
                      value={activeAd.ctaType}
                      onChange={(e) =>
                        updateActiveAd({
                          ctaType: e.target.value as MetaCtaType,
                        })
                      }
                      className="w-full px-2.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <option value="BOOK_NOW">Book Now</option>
                      <option value="GET_QUOTE">Get Quote</option>
                      <option value="CALL_NOW">Call Now</option>
                      <option value="SEND_MESSAGE">Send Message</option>
                      <option value="LEARN_MORE">Learn More</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Image Overlay Badge
                    </label>
                    <input
                      type="text"
                      value={activeAd.promoBadge}
                      onChange={(e) =>
                        updateActiveAd({ promoBadge: e.target.value })
                      }
                      placeholder="100% Inspection Ready"
                      className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                {/* Primary Text */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-800">
                      Primary Text (Appears above the image in Facebook &amp; below in Instagram)
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      {activeAd.primaryText.length} chars
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={activeAd.primaryText}
                    onChange={(e) =>
                      updateActiveAd({ primaryText: e.target.value })
                    }
                    className="w-full p-3 text-xs leading-relaxed bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                  />
                </div>

                {/* Headline (<=40 chars) & Link Description (<=30 chars) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-800">
                        Headline (Bold Bar Below Image)
                      </label>
                      <span
                        className={`text-[11px] font-mono ${
                          activeAd.headline.length > 40
                            ? "text-rose-600 font-bold"
                            : "text-emerald-700"
                        }`}
                      >
                        {activeAd.headline.length}/40 chars
                      </span>
                    </div>
                    <input
                      type="text"
                      value={activeAd.headline}
                      onChange={(e) =>
                        updateActiveAd({ headline: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-800">
                        Link Description (Subtext Next to CTA)
                      </label>
                      <span
                        className={`text-[11px] font-mono ${
                          activeAd.linkDescription.length > 30
                            ? "text-rose-600 font-bold"
                            : "text-emerald-700"
                        }`}
                      >
                        {activeAd.linkDescription.length}/30 chars
                      </span>
                    </div>
                    <input
                      type="text"
                      value={activeAd.linkDescription}
                      onChange={(e) =>
                        updateActiveAd({ linkDescription: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                {/* Destination URL & Quick Image Picker */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                  <div className="sm:col-span-8">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Booking Destination URL
                    </label>
                    <input
                      type="url"
                      value={activeAd.destinationUrl}
                      onChange={(e) =>
                        updateActiveAd({ destinationUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onOpenImageStudio}
                      className="flex-1 py-2 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-[#ec4899]" />
                      AI Ad Image Studio
                    </button>
                    {fbConfig.ads.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const filtered = fbConfig.ads.filter(
                            (_, i) => i !== selectedAdIndex
                          );
                          updateFbConfig({ ads: filtered });
                          setSelectedAdIndex(0);
                        }}
                        className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600"
                        title="Delete this ad variation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Session AI Images Strip if available */}
                {(campaign.generatedImages || []).length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-700">
                      Select an AI Cleaning Photo for This Meta Ad:
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {(campaign.generatedImages || []).map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() =>
                            updateActiveAd({ imageUrl: img.imageUrl })
                          }
                          className={`relative rounded-lg overflow-hidden border-2 shrink-0 ${
                            previewImageUrl === img.imageUrl
                              ? "border-[#ec4899]"
                              : "border-transparent opacity-75 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={img.imageUrl}
                            alt={img.sceneTitle}
                            className="w-16 h-16 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Edmonton Local Geo-Radius, Audience Interests & Budget */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                2. Meta Ad Set Targeting, Daily Budget &amp; Instant Lead Form
              </h3>
              <p className="text-xs text-slate-500">
                Configured for local residential cleaning leads in{" "}
                {campaign.location || "Edmonton"}
              </p>
            </div>

            {/* Daily Budget Slider */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-[#ec4899]" />
                    Meta Daily Ad Set Budget (CAD / day)
                  </label>
                  <div className="text-[11px] text-slate-500">
                    Est. Monthly: <strong>${monthlyMetaBudget} CAD/mo</strong> ·
                    Est. Daily Local Reach:{" "}
                    <strong>
                      {estDailyReachMin.toLocaleString()}–
                      {estDailyReachMax.toLocaleString()} people/day
                    </strong>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-700">$</span>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={fbConfig.dailyBudgetCad}
                    onChange={(e) =>
                      updateFbConfig({
                        dailyBudgetCad: Math.max(5, Number(e.target.value) || 5),
                      })
                    }
                    className="w-20 px-2.5 py-1.5 text-sm font-bold font-mono text-right bg-white border border-slate-300 rounded-lg"
                  />
                  <span className="text-xs text-slate-500">CAD/day</span>
                </div>
              </div>
              <input
                type="range"
                min={5}
                max={150}
                step={5}
                value={Math.min(150, fbConfig.dailyBudgetCad)}
                onChange={(e) =>
                  updateFbConfig({ dailyBudgetCad: Number(e.target.value) })
                }
                className="w-full accent-[#ec4899] cursor-pointer"
              />
            </div>

            {/* Radius, Age & Objective */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Campaign Objective
                </label>
                <select
                  value={fbConfig.objective}
                  onChange={(e) =>
                    updateFbConfig({
                      objective: e.target.value as FacebookCampaignConfig["objective"],
                    })
                  }
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="OUTCOME_LEADS">
                    Leads (Instant Form + Booking)
                  </option>
                  <option value="OUTCOME_SALES">
                    Website Booking Conversions
                  </option>
                  <option value="OUTCOME_TRAFFIC">
                    Website &amp; Call Traffic
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Local Drop-Pin Radius (km)
                </label>
                <input
                  type="number"
                  min={5}
                  max={80}
                  value={fbConfig.radiusKm}
                  onChange={(e) =>
                    updateFbConfig({
                      radiusKm: Math.max(5, Number(e.target.value) || 25),
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Homeowner / Renter Age Range
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={18}
                    max={60}
                    value={fbConfig.ageMin}
                    onChange={(e) =>
                      updateFbConfig({ ageMin: Number(e.target.value) || 23 })
                    }
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="number"
                    min={25}
                    max={65}
                    value={fbConfig.ageMax}
                    onChange={(e) =>
                      updateFbConfig({ ageMax: Number(e.target.value) || 65 })
                    }
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Target Locations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#ec4899]" />
                  Targeted Cities &amp; Service Areas
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newLocationInput.trim()) {
                      updateFbConfig({
                        locations: [
                          ...fbConfig.locations,
                          newLocationInput.trim(),
                        ],
                      });
                      setNewLocationInput("");
                    }
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={newLocationInput}
                    onChange={(e) => setNewLocationInput(e.target.value)}
                    placeholder="Add city/neighborhood..."
                    className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-900 text-white rounded-md"
                  >
                    + Add
                  </button>
                </form>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fbConfig.locations.map((loc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md font-medium"
                  >
                    <span>{loc}</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateFbConfig({
                          locations: fbConfig.locations.filter(
                            (_, i) => i !== idx
                          ),
                        })
                      }
                      className="text-slate-400 hover:text-rose-600 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Detailed Audience Interests */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#a855f7]" />
                  Meta Detailed Targeting Interests (Movers, Renters, Real Estate)
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newInterestInput.trim()) {
                      updateFbConfig({
                        interests: [
                          ...fbConfig.interests,
                          newInterestInput.trim(),
                        ],
                      });
                      setNewInterestInput("");
                    }
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={newInterestInput}
                    onChange={(e) => setNewInterestInput(e.target.value)}
                    placeholder="Add interest..."
                    className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-900 text-white rounded-md"
                  >
                    + Add
                  </button>
                </form>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fbConfig.interests.map((interest, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 text-xs bg-purple-50 text-purple-900 border border-purple-200 px-2.5 py-1 rounded-md font-medium"
                  >
                    <span>{interest}</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateFbConfig({
                          interests: fbConfig.interests.filter(
                            (_, i) => i !== idx
                          ),
                        })
                      }
                      className="text-purple-400 hover:text-rose-600 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Meta Instant Lead Form Questions & Privacy Policy Link */}
            <div className="space-y-2.5 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Meta Instant Lead Form Questions &amp; Required Privacy Policy
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Meta requires a live Privacy Policy URL for all Lead Forms —
                    pre-configured to{" "}
                    <code className="font-mono text-slate-800">
                      {fbConfig.privacyPolicyUrl}
                    </code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPlacement("lead_form")}
                  className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-semibold"
                >
                  Preview Lead Form →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Meta Lead Form Privacy Policy URL
                  </label>
                  <input
                    type="url"
                    value={fbConfig.privacyPolicyUrl}
                    onChange={(e) =>
                      updateFbConfig({ privacyPolicyUrl: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Add Lead Form Question
                  </label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newQuestionInput.trim()) {
                        updateFbConfig({
                          leadFormQuestions: [
                            ...fbConfig.leadFormQuestions,
                            newQuestionInput.trim(),
                          ],
                        });
                        setNewQuestionInput("");
                      }
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={newQuestionInput}
                      onChange={(e) => setNewQuestionInput(e.target.value)}
                      placeholder="e.g. Preferred Cleaning Date?"
                      className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg"
                    >
                      + Add
                    </button>
                  </form>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {fbConfig.leadFormQuestions.map((q, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md"
                  >
                    <span>
                      {idx + 1}. {q}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateFbConfig({
                          leadFormQuestions: fbConfig.leadFormQuestions.filter(
                            (_, i) => i !== idx
                          ),
                        })
                      }
                      className="text-slate-400 hover:text-rose-600 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Sticky Live Facebook Feed, Instagram Feed, Story/Reel & Lead Form Simulator */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-[#ec4899]" />
                  Live Meta Placement Simulator
                </h3>
                <p className="text-[11px] text-slate-500">
                  Preview how your TidyUps Cleaning ad renders across Facebook &amp; Instagram
                </p>
              </div>
            </div>

            {/* Placement Switcher */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: "facebook_feed", label: "FB Feed" },
                  { id: "instagram_feed", label: "IG Feed" },
                  { id: "stories_reels", label: "Story / Reel" },
                  { id: "lead_form", label: "Lead Form" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPreviewPlacement(tab.id)}
                  className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                    previewPlacement === tab.id
                      ? "brand-gradient text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Placement 1: Facebook Feed Preview */}
            {previewPlacement === "facebook_feed" && activeAd && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* FB Header */}
                <div className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white font-extrabold text-xs">
                      TU
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <span>TidyUps Cleaning</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 fill-blue-600 text-white" />
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Sponsored · 🌍 {campaign.location || "Edmonton"}
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-400 font-bold text-sm">•••</span>
                </div>

                {/* FB Primary Text */}
                <div className="px-3.5 pb-3 text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                  {activeAd.primaryText}
                </div>

                {/* FB Media Visual */}
                <div className="relative bg-slate-900 aspect-square flex items-center justify-center overflow-hidden">
                  {previewImageUrl ? (
                    <img
                      src={previewImageUrl}
                      alt={activeAd.headline}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="p-6 text-center space-y-2 bg-gradient-to-br from-[#120e17] via-[#1f1629] to-[#2d1b3d] w-full h-full flex flex-col items-center justify-center">
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold brand-gradient text-white">
                        {activeAd.promoBadge || "Edmonton Cleaning Pros"}
                      </span>
                      <div className="text-lg font-extrabold text-white max-w-xs leading-snug">
                        {activeAd.headline}
                      </div>
                      <div className="text-xs text-[#a899b3]">
                        Call {campaign.phoneNumber || "587-742-2500"} ·{" "}
                        {activeAd.displayLink}
                      </div>
                      <button
                        type="button"
                        onClick={onOpenImageStudio}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium border border-white/15"
                      >
                        + Generate AI Cleaning Photo
                      </button>
                    </div>
                  )}

                  {activeAd.promoBadge && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold brand-gradient text-white shadow-md">
                      {activeAd.promoBadge}
                    </div>
                  )}
                </div>

                {/* FB Link Bar */}
                <div className="p-3 bg-[#F0F2F5] border-t border-slate-200 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 truncate">
                      {activeAd.displayLink || "app.tidyupscleaning.com"}
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                      {activeAd.headline}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate">
                      {activeAd.linkDescription}
                    </div>
                  </div>
                  <span className="px-3.5 py-2 rounded-md bg-[#E4E6EB] text-slate-900 font-bold text-xs whitespace-nowrap shrink-0">
                    {META_CTA_LABELS[activeAd.ctaType]}
                  </span>
                </div>

                {/* FB Social Actions */}
                <div className="px-4 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <ThumbsUp className="w-3.5 h-3.5" /> Like
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" /> Comment
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </span>
                </div>
              </div>
            )}

            {/* Placement 2: Instagram Feed Preview */}
            {previewPlacement === "instagram_feed" && activeAd && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-xs">
                      TU
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        tidyupscleaning
                      </div>
                      <div className="text-[10px] text-slate-500">Sponsored</div>
                    </div>
                  </div>
                  <span className="text-slate-400 font-bold">•••</span>
                </div>

                <div className="relative bg-slate-900 aspect-square flex items-center justify-center overflow-hidden">
                  {previewImageUrl ? (
                    <img
                      src={previewImageUrl}
                      alt={activeAd.headline}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="p-6 text-center space-y-2 bg-gradient-to-br from-[#120e17] via-[#1f1629] to-[#2d1b3d] w-full h-full flex flex-col items-center justify-center">
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold brand-gradient text-white">
                        {activeAd.promoBadge}
                      </span>
                      <div className="text-lg font-extrabold text-white">
                        {activeAd.headline}
                      </div>
                      <div className="text-xs text-[#a899b3]">
                        {campaign.location} · {campaign.phoneNumber}
                      </div>
                    </div>
                  )}
                </div>

                {/* IG CTA Strip */}
                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600">
                    {META_CTA_LABELS[activeAd.ctaType]}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                </div>

                <div className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-slate-800">
                    <div className="flex items-center gap-3">
                      <Heart className="w-4 h-4" />
                      <MessageCircle className="w-4 h-4" />
                      <Send className="w-4 h-4" />
                    </div>
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                    <strong className="mr-1.5">tidyupscleaning</strong>
                    {activeAd.primaryText}
                  </div>
                </div>
              </div>
            )}

            {/* Placement 3: Instagram / Facebook Story & Reel (9:16) */}
            {previewPlacement === "stories_reels" && activeAd && (
              <div className="mx-auto max-w-[300px] aspect-[9/16] rounded-2xl bg-gradient-to-b from-[#120e17] via-[#1a1324] to-[#0d0a0f] border border-slate-800 text-white p-4 flex flex-col justify-between relative overflow-hidden shadow-lg">
                {previewImageUrl && (
                  <img
                    src={previewImageUrl}
                    alt={activeAd.headline}
                    className="absolute inset-0 w-full h-full object-cover opacity-45"
                  />
                )}
                <div className="relative z-10 space-y-2">
                  <div className="h-1 w-full bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full w-2/3 brand-gradient" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full brand-gradient flex items-center justify-center text-[10px] font-bold">
                      TU
                    </div>
                    <div>
                      <div className="text-xs font-bold">TidyUps Cleaning</div>
                      <div className="text-[10px] text-white/80">
                        Sponsored · {campaign.location}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 my-auto space-y-2.5 bg-black/65 backdrop-blur-xs p-3.5 rounded-xl border border-white/15">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold brand-gradient text-white">
                    {activeAd.promoBadge}
                  </span>
                  <div className="text-base font-extrabold leading-snug">
                    {activeAd.headline}
                  </div>
                  <p className="text-[11px] text-white/90 line-clamp-4 whitespace-pre-line">
                    {activeAd.primaryText}
                  </p>
                  <div className="text-xs font-mono font-bold text-[#FF7B54] flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {campaign.phoneNumber || "587-742-2500"}
                  </div>
                </div>

                <div className="relative z-10 pt-2 text-center">
                  <div className="w-full py-2.5 rounded-full brand-gradient text-white font-bold text-xs shadow-md">
                    {META_CTA_LABELS[activeAd.ctaType]} ↑
                  </div>
                </div>
              </div>
            )}

            {/* Placement 4: Meta Instant Lead Form Modal Preview */}
            {previewPlacement === "lead_form" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3.5">
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200">
                  <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-xs">
                    TU
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      TidyUps Cleaning — Instant Quote Form
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {campaign.location} · Call{" "}
                      {campaign.phoneNumber || "587-742-2500"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {fbConfig.leadFormQuestions.map((q, i) => (
                    <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {q}
                      </label>
                      <div className="h-7 rounded bg-slate-50 border border-slate-200 px-2 flex items-center text-[11px] text-slate-400">
                        Auto-filled by Meta user profile...
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600">
                  By clicking Submit, you agree to send your info to{" "}
                  <strong>TidyUps Cleaning</strong> in accordance with their{" "}
                  <a
                    href={fbConfig.privacyPolicyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-700 underline font-medium"
                  >
                    Privacy Policy ({fbConfig.privacyPolicyUrl})
                  </a>
                  .
                </div>

                <div className="w-full py-2.5 rounded-lg brand-gradient text-white text-center text-xs font-bold">
                  Submit &amp; View Instant Online Quote →
                </div>
              </div>
            )}

            {/* Quick Export & Sync Actions inside Simulator Card */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenLaunchTab}
                className="flex-1 py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Save Google + FB Ads to Color-Coded Sheet
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Meta Marketing API Payload & Meta Pixel Lead Snippet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Meta Marketing API JSON */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Code2 className="w-4 h-4 text-[#ec4899]" />
              <span>Meta Marketing API v21.0 Campaign + Lead Form Payload</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(
                  JSON.stringify(metaApiPayload, null, 2)
                );
                setCopiedJson(true);
                setTimeout(() => setCopiedJson(false), 2000);
              }}
              className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-medium flex items-center gap-1.5"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied JSON
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy API JSON
                </>
              )}
            </button>
          </div>
          <pre className="p-4 bg-[#0d0a0f] text-slate-100 text-[11px] font-mono overflow-x-auto max-h-[260px]">
            <code>{JSON.stringify(metaApiPayload, null, 2)}</code>
          </pre>
        </div>

        {/* Meta Pixel Lead Event Snippet */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Code2 className="w-4 h-4 text-[#a855f7]" />
              <span>Meta Pixel Lead Conversion Snippet (fbq)</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(metaPixelSnippet);
                setCopiedPixel(true);
                setTimeout(() => setCopiedPixel(false), 2000);
              }}
              className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-medium flex items-center gap-1.5"
            >
              {copiedPixel ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied Pixel
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Pixel Code
                </>
              )}
            </button>
          </div>
          <pre className="p-4 bg-[#0d0a0f] text-slate-100 text-[11px] font-mono overflow-x-auto max-h-[260px]">
            <code>{metaPixelSnippet}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
