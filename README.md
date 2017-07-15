## t-sne-lab: an interactive frontend for t-SNE

t-sne-lab is a laboratory for you to interactively explore
a high-dimensional numerical dataset using the t-sne visualization.
It reads a csv file and allows you to choose
which categorical field to be used for color painting,
and which categorical field to be used for labeling the data points.
You can also try different values of the perplexity
and epsilon parameters.
See [demo page](https://ckhung.github.io/t-sne-lab/t-sne-lab.html).

Edit config.json to specify your csv file and other customization values.
The csv file can be either a local file or an URL.
If the csv file is local, then please see
[this illustration](https://github.com/ckhung/javascriptCanReadLocalFiles)
for how to use t-sne-lab in Chrome. Firefox is fine.

t-sne-lab is a front-end of Andrej Karpathy's
[javascript implementation](https://github.com/karpathy/tsnejs)
of t-SNE.  [t-SNE](https://lvdmaaten.github.io/tsne/)
is a machine-learning algorithm for visualizing
high-dimensional numerical datasets in 2-D or 3-D
invented by Laurens van der Maaten.

