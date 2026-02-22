FROM e2b/base:latest

# python data science stack
RUN pip install pandas matplotlib plotly seaborn numpy

# integration SDK packages
RUN pip install stripe

# node packages for JS execution
RUN npm install -g stripe @googlemaps/google-maps-services-js

# output directory for generated artifacts
RUN mkdir -p /output /data
