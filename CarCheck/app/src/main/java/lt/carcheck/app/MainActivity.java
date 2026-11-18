package lt.carcheck.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Thin shell: loads the web app from assets/www. All UI, texts and checklist data live there,
 * so normally you only edit files inside app/src/main/assets/www/.
 */
public class MainActivity extends Activity {

    private WebView web;
    private WebView printView; // kept as a field so it is not garbage-collected while printing

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0A0A0B"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // localStorage keeps the inspection if the app is closed
        s.setTextZoom(100);

        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient());
        web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    public void onBackPressed() {
        // Let the web app handle "back" (previous category); exit only from the first screen.
        web.evaluateJavascript("window.appBack ? window.appBack() : false", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (!"true".equals(value)) {
                    MainActivity.super.onBackPressed();
                }
            }
        });
    }

    private class Bridge {
        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(i, null));
                }
            });
        }

        /** Renders the report HTML and opens Android's print dialog: choose "Save as PDF". */
        @JavascriptInterface
        public void printReport(final String html, final String name) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    printView = new WebView(MainActivity.this);
                    printView.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(name);
                            PrintAttributes attrs = new PrintAttributes.Builder()
                                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                    .build();
                            pm.print(name, adapter, attrs);
                        }
                    });
                    printView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
                }
            });
        }
    }
}
