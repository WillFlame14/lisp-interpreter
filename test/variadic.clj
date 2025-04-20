(defn list [& args] args)

(let [f (fn [a b & c] (list a b c))]
  (__print (f 1 2 3 4 5 6)))